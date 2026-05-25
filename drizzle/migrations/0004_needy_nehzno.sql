CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: turn each distinct legacy free-text project into a real project row...
INSERT INTO "projects" ("name")
  SELECT DISTINCT trim("project") FROM "tickets"
  WHERE "project" IS NOT NULL AND trim("project") <> ''
  ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- ...then link existing tickets to their backfilled project.
UPDATE "tickets" t SET "project_id" = p."id"
  FROM "projects" p WHERE trim(t."project") = p."name";