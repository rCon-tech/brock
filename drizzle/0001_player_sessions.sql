CREATE TABLE "player_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player" DROP CONSTRAINT "player_token_hash_unique";--> statement-breakpoint
ALTER TABLE "player_session" ADD CONSTRAINT "player_session_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_session_player_idx" ON "player_session" USING btree ("player_id");--> statement-breakpoint
-- Keep everyone who is already playing logged in: move their browser token into player_session.
INSERT INTO "player_session" ("token_hash", "player_id", "created_at") SELECT "token_hash", "id", "created_at" FROM "player";--> statement-breakpoint
ALTER TABLE "player" DROP COLUMN "token_hash";--> statement-breakpoint
ALTER TABLE "player" DROP COLUMN "recovery_hash";