import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listUnits, listLessonSlugs, loadLesson } from "@/lib/content";
import { FlashcardPicker } from "@/components/flashcards/FlashcardPicker";

function isVocabLesson(slug: string, title: string): boolean {
  if (slug.startsWith("vocab-")) return true;
  const t = title.toLowerCase();
  return t.startsWith("vocabulary") || t.includes("vocabulary quiz");
}

export default async function FlashcardsPracticePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const units = listUnits();
  const catalog = units
    .map((u) => {
      const lessons = listLessonSlugs(u.slug)
        .map((slug) => {
          const L = loadLesson(u.slug, slug);
          if (!L) return null;
          if (!isVocabLesson(L.slug, L.title)) return null;
          return { slug: L.slug, title: L.title, order: L.order };
        })
        .filter(Boolean) as { slug: string; title: string; order: number }[];
      lessons.sort((a, b) => a.order - b.order);
      if (lessons.length === 0) return null;
      return {
        unitSlug: u.slug,
        unitTitle: u.title,
        order: u.order,
        lessons,
      };
    })
    .filter(Boolean) as {
    unitSlug: string;
    unitTitle: string;
    order: number;
    lessons: { slug: string; title: string; order: number }[];
  }[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-800 dark:text-violet-400">
          Practice
        </p>
        <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-50">
          Vocabulary flashcards
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Choose vocabulary lessons (or jump to words you often miss). Latin
          first, English on flip. This does{" "}
          <strong className="font-semibold">not</strong> count toward lesson
          standards.
        </p>
      </header>
      <FlashcardPicker catalog={catalog} />
    </main>
  );
}
