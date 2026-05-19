-- ─── New enums (all genuinely new) ──────────────────────────────────────────
CREATE TYPE "public"."notion_sync_status" AS ENUM('synced', 'pending', 'failed', 'never');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('push', 'pull');--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('ticket', 'checklist', 'comment');--> statement-breakpoint
CREATE TYPE "public"."sync_result_status" AS ENUM('success', 'failure');--> statement-breakpoint

-- ─── user_role: 'admin' already exists in prod, this is a no-op there ───────
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin' BEFORE 'team_member';--> statement-breakpoint

-- ─── invites: table already exists in prod (drift from push). IF NOT EXISTS makes this safe. ───
CREATE TABLE IF NOT EXISTS "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'team_member' NOT NULL,
	"token" text NOT NULL,
	"message" text,
	"invited_by_id" uuid,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invites_email_unique" UNIQUE("email"),
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint

-- ─── New sync tables ────────────────────────────────────────────────────────
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" "sync_direction" NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" uuid,
	"notion_page_id" text,
	"status" "sync_result_status" NOT NULL,
	"error_message" text,
	"payload" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_poll_at" timestamp with time zone,
	"last_poll_status" "sync_result_status",
	"last_poll_error" text,
	CONSTRAINT "sync_state_singleton" CHECK ("sync_state"."id" = 1)
);
--> statement-breakpoint

-- ─── ticket_status: full enum swap with data remap (CASE) ───────────────────
-- Why this shape: Postgres won't let us remove values from an enum in place,
-- and the auto-generated USING cast can't translate 'open' → 'not_started'.
-- We rename the old enum, create the new one, cast the column with explicit
-- mapping, then drop the renamed old type.
ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."ticket_status" RENAME TO "ticket_status_old";--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('not_started','on_track','behind','at_risk','reprioritized','accomplished','failed');--> statement-breakpoint
ALTER TABLE "tickets"
  ALTER COLUMN "status" TYPE "public"."ticket_status"
  USING (CASE "status"::text
    WHEN 'open'        THEN 'not_started'
    WHEN 'in_progress' THEN 'on_track'
    WHEN 'review'      THEN 'behind'
    WHEN 'done'        THEN 'accomplished'
    WHEN 'closed'      THEN 'accomplished'
    ELSE 'not_started'
  END)::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'not_started';--> statement-breakpoint
DROP TYPE "public"."ticket_status_old";--> statement-breakpoint

-- ─── New columns on tickets (all genuinely new) ─────────────────────────────
ALTER TABLE "tickets" ADD COLUMN "deadline_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "project" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "expected_results" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_page_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_last_edited_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_sync_status" "notion_sync_status" DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_notion_page_id_unique" UNIQUE("notion_page_id");--> statement-breakpoint

-- ─── invites FK: doesn't exist in prod yet, add via DO block for idempotency ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_invited_by_id_users_id_fk'
  ) THEN
    ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_users_id_fk"
      FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "invites_email_idx" ON "invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sync_logs_status_created_idx" ON "sync_logs" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sync_logs_entity_idx" ON "sync_logs" USING btree ("entity_id");
