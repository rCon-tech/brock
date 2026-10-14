CREATE TYPE "public"."brock_status" AS ENUM('pending', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."round_result" AS ENUM('win', 'loss', 'draw');--> statement-breakpoint
CREATE TYPE "public"."throw" AS ENUM('rock', 'paper', 'scissors');--> statement-breakpoint
CREATE TABLE "brock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" "brock_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "brock_player_day_unique" UNIQUE("player_id","day")
);
--> statement-breakpoint
CREATE TABLE "brock_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brock_id" uuid NOT NULL,
	"round_no" integer NOT NULL,
	"house_throw" "throw" NOT NULL,
	"salt" text NOT NULL,
	"commit_hash" text NOT NULL,
	"player_throw" "throw",
	"result" "round_result",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revealed_at" timestamp with time zone,
	CONSTRAINT "brock_round_brock_no_unique" UNIQUE("brock_id","round_no")
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"handle" varchar(20),
	"recovery_hash" text,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_win_day" date,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "brock" ADD CONSTRAINT "brock_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brock_round" ADD CONSTRAINT "brock_round_brock_id_brock_id_fk" FOREIGN KEY ("brock_id") REFERENCES "public"."brock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_handle_lower_idx" ON "player" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "player_leaderboard_idx" ON "player" USING btree ("last_win_day","current_streak" DESC);