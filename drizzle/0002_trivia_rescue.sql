CREATE TYPE "public"."rescue_status" AS ENUM('offered', 'asked', 'passed', 'failed');--> statement-breakpoint
CREATE TABLE "brock_rescue" (
	"brock_id" uuid PRIMARY KEY NOT NULL,
	"streak_before" integer NOT NULL,
	"status" "rescue_status" DEFAULT 'offered' NOT NULL,
	"question_id" text,
	"options" jsonb,
	"answer_index" integer,
	"chosen_index" integer,
	"asked_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brock_rescue" ADD CONSTRAINT "brock_rescue_brock_id_brock_id_fk" FOREIGN KEY ("brock_id") REFERENCES "public"."brock"("id") ON DELETE cascade ON UPDATE no action;