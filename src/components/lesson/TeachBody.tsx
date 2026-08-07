import type { ComponentPropsWithoutRef } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { lessonComponents } from "@/components/lesson-blocks";

const heading = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-2 mb-4 border-b border-stone-200 pb-2 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:border-stone-700 dark:text-stone-50"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-8 mb-3 font-serif text-sm font-bold uppercase tracking-wide text-amber-900 dark:text-amber-400/90"
      {...props}
    />
  ),
  h4: (props: ComponentPropsWithoutRef<"h4">) => (
    <h4
      className="mt-5 mb-2 font-serif text-base font-semibold text-stone-800 dark:text-stone-100"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p
      className="my-3 text-[15px] leading-relaxed text-stone-800 dark:text-stone-200"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="my-3 list-disc space-y-1 pl-5 text-[15px] text-stone-800 dark:text-stone-200"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-5 text-[15px] text-stone-800 dark:text-stone-200"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-stone-900 dark:text-stone-50" {...props} />
  ),
  em: (props: ComponentPropsWithoutRef<"em">) => (
    <em className="font-serif italic text-stone-900 dark:text-stone-100" {...props} />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="not-prose my-4 overflow-x-auto rounded-xl border border-stone-200 shadow-sm dark:border-stone-700">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-stone-100 dark:bg-stone-800" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border-b border-stone-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-stone-600 dark:border-stone-700 dark:text-stone-300"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td
      className="border-b border-stone-100 px-3 py-2.5 align-top text-stone-800 dark:border-stone-800 dark:text-stone-200"
      {...props}
    />
  ),
  tr: (props: ComponentPropsWithoutRef<"tr">) => (
    <tr className="even:bg-stone-50/80 dark:even:bg-stone-900/50" {...props} />
  ),
};

/**
 * Server-rendered rich teach content (MDX + lesson component palette).
 */
export async function TeachBody({ source }: { source: string }) {
  try {
    return (
      <div className="teach-body max-w-none">
        <MDXRemote
          source={source}
          components={{
            ...lessonComponents,
            ...heading,
          }}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
      </div>
    );
  } catch (err) {
    console.error("TeachBody MDX error", err);
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Could not render lesson content. Check the MDX for this lesson.
      </div>
    );
  }
}
