import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const answerStatusEnum = pgEnum("answer_status", [
  "pending",
  "partial",
  "passed",
]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Login id — no email; lowercase unique */
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isTeacher: boolean("is_teacher").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** AI-generated (or runtime-expanded) activities, keyed per user+lesson. */
export const generatedActivities = pgTable(
  "generated_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonSlug: text("lesson_slug").notNull(),
    /** Full Activity JSON (type, prompt, payload, targets, …) */
    activity: jsonb("activity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_generated_activities_user_lesson").on(t.userId, t.lessonSlug),
  ]
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonSlug: text("lesson_slug").notNull(),
    /** Seed activity id or generated activity id */
    activityId: text("activity_id").notNull(),
    response: jsonb("response").notNull(),
    status: answerStatusEnum("status").notNull().default("pending"),
    feedback: text("feedback"),
    issues: jsonb("issues").$type<string[]>().default([]),
    attemptNumber: integer("attempt_number").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_attempts_user_lesson").on(t.userId, t.lessonSlug),
    index("idx_attempts_activity").on(t.userId, t.activityId),
  ]
);

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonSlug: text("lesson_slug").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** teacher override or standard engine */
    source: text("source").notNull().default("standard"),
  },
  (t) => [
    unique("lesson_completions_user_lesson").on(t.userId, t.lessonSlug),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonSlug: text("lesson_slug").notNull(),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_chat_messages_user_lesson").on(t.userId, t.lessonSlug),
  ]
);

/**
 * Optional practice flashcards (not part of lesson standard).
 * cardKey is a stable hash of front|back so the same fact merges across lessons.
 */
export const flashcardProgress = pgTable(
  "flashcard_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Stable id: hash of normalized front + back */
    cardKey: text("card_key").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    /** Last known source lesson slugs (JSON string array) */
    sourceLessons: jsonb("source_lessons").$type<string[]>().default([]),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    /** Current streak of correct answers */
    streak: integer("streak").notNull().default(0),
    lastResult: text("last_result"), // "know" | "again"
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("flashcard_progress_user_card").on(t.userId, t.cardKey),
    index("idx_flashcard_progress_user").on(t.userId),
  ]
);
