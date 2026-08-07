import fs from "fs";
import path from "path";
import {
  lessonContentSchema,
  unitContentSchema,
  type Activity,
  type LessonContent,
  type UnitContent,
} from "@/types/activity";
import { expandFromPattern } from "@/lib/activities/templates";

const CONTENT_ROOT = path.join(process.cwd(), "content", "units");

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function listUnits(): UnitContent[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  const dirs = fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const units: UnitContent[] = [];
  for (const dir of dirs) {
    const unitPath = path.join(CONTENT_ROOT, dir, "unit.json");
    if (!fs.existsSync(unitPath)) continue;
    const parsed = unitContentSchema.safeParse(readJsonFile(unitPath));
    if (parsed.success) units.push(parsed.data);
    else console.error("Invalid unit.json", dir, parsed.error.issues);
  }
  return units.sort((a, b) => a.order - b.order);
}

export function listLessonSlugs(unitSlug: string): string[] {
  const lessonsDir = path.join(CONTENT_ROOT, unitSlug, "lessons");
  if (!fs.existsSync(lessonsDir)) return [];
  return fs
    .readdirSync(lessonsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function loadLesson(
  unitSlug: string,
  lessonSlug: string
): LessonContent | null {
  const filePath = path.join(
    CONTENT_ROOT,
    unitSlug,
    "lessons",
    `${lessonSlug}.json`
  );
  if (!fs.existsSync(filePath)) return null;
  const parsed = lessonContentSchema.safeParse(readJsonFile(filePath));
  if (!parsed.success) {
    console.error("Invalid lesson", unitSlug, lessonSlug, parsed.error.issues);
    return null;
  }
  const lesson = parsed.data;
  lesson.seeds = lesson.seeds.map((a) => expandFromPattern(a));
  return lesson;
}

export function loadLessonBySlug(lessonSlug: string): LessonContent | null {
  for (const unit of listUnits()) {
    for (const slug of listLessonSlugs(unit.slug)) {
      if (slug === lessonSlug) return loadLesson(unit.slug, slug);
    }
  }
  return null;
}

/** All lessons in curriculum order. */
export function listAllLessons(): LessonContent[] {
  const out: LessonContent[] = [];
  for (const unit of listUnits()) {
    for (const slug of listLessonSlugs(unit.slug)) {
      const lesson = loadLesson(unit.slug, slug);
      if (lesson) out.push(lesson);
    }
  }
  return out.sort((a, b) => {
    const ua = listUnits().find((u) => u.slug === a.unitSlug)?.order ?? 0;
    const ub = listUnits().find((u) => u.slug === b.unitSlug)?.order ?? 0;
    if (ua !== ub) return ua - ub;
    return a.order - b.order;
  });
}

export function getAdjacentLessons(lessonSlug: string): {
  prev: LessonContent | null;
  next: LessonContent | null;
} {
  const all = listAllLessons();
  const idx = all.findIndex((l) => l.slug === lessonSlug);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1]! : null,
    next: idx < all.length - 1 ? all[idx + 1]! : null,
  };
}

export function resolveActivity(
  lesson: LessonContent,
  activityId: string,
  generated: Activity[]
): Activity | null {
  const seed = lesson.seeds.find((a) => a.id === activityId);
  if (seed) return seed;
  return generated.find((a) => a.id === activityId) ?? null;
}
