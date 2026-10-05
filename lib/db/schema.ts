import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  encryptedKey: text("encrypted_key").notNull().default(""),
  baseUrl: text("base_url"),
  models: text("models").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const roasts = sqliteTable("roasts", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  inputType: text("input_type").notNull(),
  inputSource: text("input_source"),
  code: text("code").notNull().default(""),
  codeSnapshot: text("code_snapshot"),
  selectedRoasters: text("selected_roasters").notNull().default("[]"),
  modelAssignments: text("model_assignments").notNull().default("{}"),
  results: text("results").notNull().default("[]"),
  overallScore: integer("overall_score"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const roastEvents = sqliteTable("roast_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roastId: text("roast_id").notNull(),
  seq: integer("seq").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
