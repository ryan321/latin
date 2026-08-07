/**
 * Minimal OpenRouter client (OpenAI-compatible chat completions).
 * Requires OPENROUTER_API_KEY.
 *
 * Model: GRADER_MODEL / TUTOR_MODEL / GENERATE_MODEL → DEFAULT_MODEL → fallback
 *
 * DeepSeek reasoning models can exhaust max_tokens on thinking; we default
 * minimal effort, allow REASONING_OFF for JSON tasks, and retry empty content.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const HARDCODED_FALLBACK = "deepseek/deepseek-v4-pro-0731";

export const DEFAULT_MODEL =
  process.env.DEFAULT_MODEL?.trim() || HARDCODED_FALLBACK;

export type ReasoningConfig = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  max_tokens?: number;
  exclude?: boolean;
};

export const REASONING_OFF = {
  effort: "none",
} as const satisfies ReasoningConfig;

export const REASONING_MINIMAL = {
  effort: "minimal",
} as const satisfies ReasoningConfig;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionArgs {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens: number;
  reasoning?: ReasoningConfig | null;
  _retried?: boolean;
}

function headers(): Record<string, string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.AUTH_URL ?? "http://localhost:3040",
    "X-Title": "Latin Year 1",
  };
}

function withSystem(args: CompletionArgs): ChatMessage[] {
  return args.system
    ? [{ role: "system", content: args.system }, ...args.messages]
    : args.messages;
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
    const trimmed = parts.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function buildRequestBody(args: CompletionArgs, stream: boolean) {
  const body: Record<string, unknown> = {
    model: args.model,
    max_tokens: args.maxTokens,
    messages: withSystem(args),
  };
  if (stream) body.stream = true;
  if (args.reasoning !== null) {
    body.reasoning = args.reasoning ?? REASONING_MINIMAL;
  }
  return body;
}

type OpenRouterChoice = {
  finish_reason?: string | null;
  message?: { content?: unknown; refusal?: string | null };
};

type OpenRouterResponse = {
  model?: string;
  error?: { message?: string; code?: string | number };
  choices?: OpenRouterChoice[];
};

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `OpenRouter ${res.status}: ${body.slice(0, 500)}`;
}

export async function complete(args: CompletionArgs): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(buildRequestBody(args, false)),
  });
  if (!res.ok) throw new Error(await errorDetail(res));

  const data = (await res.json()) as OpenRouterResponse;
  if (data.error?.message) {
    throw new Error(
      `OpenRouter error: ${data.error.message}${
        data.error.code != null ? ` (${data.error.code})` : ""
      }`
    );
  }

  const choice = data.choices?.[0];
  const content = extractTextContent(choice?.message?.content);
  if (content) return content;

  if (!args._retried) {
    const retryMax = Math.max(args.maxTokens * 2, 4000);
    console.warn("OpenRouter empty content — retrying with reasoning off", {
      model: args.model,
      max_tokens: args.maxTokens,
      retry_max_tokens: retryMax,
    });
    return complete({
      ...args,
      maxTokens: retryMax,
      reasoning: REASONING_OFF,
      _retried: true,
    });
  }

  throw new Error(
    `OpenRouter returned no text content (finish=${choice?.finish_reason ?? "unknown"}, model=${data.model ?? args.model})`
  );
}

export function modelFor(
  kind: "grader" | "tutor" | "generate"
): string {
  if (kind === "grader" && process.env.GRADER_MODEL?.trim()) {
    return process.env.GRADER_MODEL.trim();
  }
  if (kind === "tutor" && process.env.TUTOR_MODEL?.trim()) {
    return process.env.TUTOR_MODEL.trim();
  }
  if (kind === "generate" && process.env.GENERATE_MODEL?.trim()) {
    return process.env.GENERATE_MODEL.trim();
  }
  return DEFAULT_MODEL;
}
