import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { lessonComponents } from "@/components/lesson-blocks";

/**
 * Server-rendered rich teach content (MDX + lesson component palette).
 * Falls back gracefully if MDX fails.
 */
export async function TeachBody({ source }: { source: string }) {
  try {
    return (
      <div className="teach-body prose prose-stone max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-lg prose-p:my-3 prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-stone-900 dark:prose-strong:text-stone-50 prose-table:text-sm">
        <MDXRemote
          source={source}
          components={lessonComponents}
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
