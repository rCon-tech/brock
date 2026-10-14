CREATE TYPE "public"."brock_status" AS ENUM('pending', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."round_result" AS ENUM('win', 'loss', 'draw');--> statement-breakpoint
CREATE TYPE "public"."throw" AS ENUM('rock', 'paper', 'scissors');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"status" "brock_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "brock_user_day_unique" UNIQUE("user_id","day")
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
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" varchar(20) NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_win_day" date,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brock" ADD CONSTRAINT "brock_user_id_player_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brock_round" ADD CONSTRAINT "brock_round_brock_id_brock_id_fk" FOREIGN KEY ("brock_id") REFERENCES "public"."brock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_handle_lower_idx" ON "player" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "player_leaderboard_idx" ON "player" USING btree ("last_win_day","current_streak" DESC);