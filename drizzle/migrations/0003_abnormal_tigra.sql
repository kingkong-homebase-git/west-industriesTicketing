ALTER TABLE "sync_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_state" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sync_logs" CASCADE;--> statement-breakpoint
DROP TABLE "sync_state" CASCADE;--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_notion_page_id_unique";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "notion_page_id";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "notion_last_edited_time";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "notion_sync_status";--> statement-breakpoint
DROP TYPE "public"."notion_sync_status";--> statement-breakpoint
DROP TYPE "public"."sync_direction";--> statement-breakpoint
DROP TYPE "public"."sync_entity_type";--> statement-breakpoint
DROP TYPE "public"."sync_result_status";