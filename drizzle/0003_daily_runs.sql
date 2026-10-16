CREATE TYPE "public"."quiz_status" AS ENUM('active', 'passed', 'failed');--> statement-breakpoint
CREATE TABLE "brock_quiz" (
	"brock_id" uuid PRIMARY KEY NOT NULL,
	"status" "quiz_status" DEFAULT 'active' NOT NULL,
	"items" jsonb NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"question_started_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brock" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "best_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "brock_quiz" ADD CONSTRAINT "brock_quiz_brock_id_brock_id_fk" FOREIGN KEY ("brock_id") REFERENCES "public"."brock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brock_day_score_idx" ON "brock" USING btree ("day","score" DESC);