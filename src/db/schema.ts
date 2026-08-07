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
  email: text("email").notNull().unique(),
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
