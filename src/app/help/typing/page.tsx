import Link from "next/link";
import { TypingHelpContent } from "@/components/latin-keyboard/LatinKeyboard";

export default function TypingHelpPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Link
        href="/"
        className="text-sm text-amber-800 hover:underline dark:text-amber-400"
      >
        ← Back to lessons
      </Link>
      <h1 className="mt-4 font-serif text-2xl font-bold text-stone-900 dark:text-stone-50">
        Typing Latin characters
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        How to type long vowels (macrons) on Mac and iPad, plus the in-app mini
        keyboard.
      </p>
      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <TypingHelpContent />
      </div>
      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h2 className="font-serif text-lg font-semibold">In this app</h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          On form drills (paradigm grids, single forms, cloze blanks), use the{" "}
          <strong>Long vowels</strong> buttons under the field. They insert ā ē
          ī ō ū without leaving the page.
        </p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Macrons are usually <strong>optional</strong> when answers are checked
          — write them when you want practice.
        </p>
      </section>
    </main>
  );
}
