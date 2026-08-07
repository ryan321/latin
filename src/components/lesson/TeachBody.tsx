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
      <div className="teach-body prose prose-stone max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-2 prose-h2:mb-4 prose-h2:border-b prose-h2:border-stone-200 prose-h2:pb-2 prose-h2:text-xl dark:prose-h2:border-stone-700 prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-base prose-h3:font-bold prose-h3:uppercase prose-h3:tracking-wide prose-h3:text-amber-900 dark:prose-h3:text-amber-400/90 prose-p:my-3 prose-p:text-[15px] prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-stone-900 dark:prose-strong:text-stone-50 prose-table:my-4 prose-table:w-full prose-th:border prose-th:border-stone-200 prose-th:bg-stone-100 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-stone-200 prose-td:px-3 prose-td:py-2 dark:prose-th:border-stone-700 dark:prose-th:bg-stone-800 dark:prose-td:border-stone-700">
        <MDXRemote
          source={source}
          components={{
            ...lessonComponents,
            // Ensure native elements keep sensible defaults under MDX
            table: (props) => (
              <div className="not-prose my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
                <table className="w-full border-collapse text-sm" {...props} />
              </div>
            ),
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
