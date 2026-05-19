CREATE TYPE "public"."notion_sync_status" AS ENUM('synced', 'pending', 'failed', 'never');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('push', 'pull');--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('ticket', 'checklist', 'comment');--> statement-breakpoint
CREATE TYPE "public"."sync_result_status" AS ENUM('success', 'failure');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'admin' BEFORE 'team_member';--> statement-breakpoint
CREATE TABLE "invites" (
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
ALTER TABLE "tickets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'not_started'::text;--> statement-breakpoint
DROP TYPE "public"."ticket_status";--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('not_started', 'on_track', 'behind', 'at_risk', 'reprioritized', 'accomplished', 'failed');--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'not_started'::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DATA TYPE "public"."ticket_status" USING "status"::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "deadline_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "project" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "expected_results" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_page_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_last_edited_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "notion_sync_status" "notion_sync_status" DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sync_logs_status_created_idx" ON "sync_logs" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sync_logs_entity_idx" ON "sync_logs" USING btree ("entity_id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_notion_page_id_unique" UNIQUE("notion_page_id");