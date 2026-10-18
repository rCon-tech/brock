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
	"is_anonymous" boolean DEFAULT false,
	"hint_seen_at" timestamp with time zone,
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
CREATE TABLE "catalogue_item" (
	"id" text PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"room_types" text[] NOT NULL,
	"category" text,
	"title" text NOT NULL,
	"description" text,
	"image_url" text NOT NULL,
	"image_w" integer,
	"image_h" integer,
	"extra_images" text[] DEFAULT '{}' NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"attribution_name" text,
	"attribution_url" text,
	"unsplash_download_location" text,
	"retailer_id" text,
	"price_pence" integer,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"product_url" text,
	"affiliate_url" text,
	"in_stock" boolean DEFAULT true NOT NULL,
	"width_cm" real,
	"depth_cm" real,
	"height_cm" real,
	"image_failures" integer DEFAULT 0 NOT NULL,
	"image_checked_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"attributes" text[] DEFAULT '{}' NOT NULL,
	"tags" jsonb,
	"primary_style" text,
	"style_weights" jsonb,
	"embedding" vector(1024),
	"tagged_at" timestamp with time zone,
	"embedded_at" timestamp with time zone,
	"last_seen_in_feed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogue_item_source_unique" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "item_stats" (
	"item_id" text PRIMARY KEY NOT NULL,
	"exposures" integer DEFAULT 0 NOT NULL,
	"rights" integer DEFAULT 0 NOT NULL,
	"tiebreak_shown" integer DEFAULT 0 NOT NULL,
	"tiebreak_mutual_yes" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"bought" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"network" text DEFAULT 'manual' NOT NULL,
	"commission_note" text,
	"cookie_days" integer
);
--> statement-breakpoint
CREATE TABLE "style" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"centroid" vector(1024),
	"item_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridge_round" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"synthesis_version" integer NOT NULL,
	"item_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"host_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"macro_done_at" timestamp with time zone,
	"micro_done_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"joined_after_reveal" boolean DEFAULT false NOT NULL,
	"last_reminded_at" timestamp with time zone,
	"vetoes_left" smallint DEFAULT 3 NOT NULL,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"room_type" text NOT NULL,
	"name" text,
	"budget_band" text,
	"context" jsonb NOT NULL,
	"mode" text DEFAULT 'remote' NOT NULL,
	"is_quiz" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"previous_project_id" text,
	"ref_partner" text,
	"macro_deck" text[] NOT NULL,
	"micro_deck" text[] NOT NULL,
	"reserve_macro" text[] DEFAULT '{}' NOT NULL,
	"reserve_micro" text[] DEFAULT '{}' NOT NULL,
	"deck_seed" text NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_enc" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipe" (
	"participant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"round" text NOT NULL,
	"value" smallint NOT NULL,
	"client_id" text NOT NULL,
	"decision_ms" integer,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipe_participant_id_item_id_round_pk" PRIMARY KEY("participant_id","item_id","round")
);
--> statement-breakpoint
CREATE TABLE "veto" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"attribute" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_feedback" (
	"project_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"helpful" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_feedback_project_id_participant_id_pk" PRIMARY KEY("project_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "item_reaction" (
	"project_id" text NOT NULL,
	"item_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"reaction" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_reaction_project_id_item_id_participant_id_pk" PRIMARY KEY("project_id","item_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "outbound_click" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"project_id" text,
	"participant_id" text,
	"surface" text DEFAULT 'board' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pick_swap" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"synthesis_version" integer NOT NULL,
	"category" text NOT NULL,
	"from_item_id" text NOT NULL,
	"to_item_id" text,
	"from_pick" jsonb NOT NULL,
	"by_participant_id" text NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_item" (
	"project_id" text NOT NULL,
	"item_id" text NOT NULL,
	"source" text NOT NULL,
	"bought_at" timestamp with time zone,
	"bought_by_participant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_item_project_id_item_id_pk" PRIMARY KEY("project_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "synthesis" (
	"project_id" text NOT NULL,
	"version" integer NOT NULL,
	"inputs_hash" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb NOT NULL,
	"bridge_name" text,
	"tagline" text,
	"rationale" text,
	"contributions" jsonb,
	"ai_model" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "synthesis_project_id_version_pk" PRIMARY KEY("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"feature" text NOT NULL,
	"project_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_item" ADD CONSTRAINT "catalogue_item_retailer_id_retailer_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_stats" ADD CONSTRAINT "item_stats_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_round" ADD CONSTRAINT "bridge_round_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veto" ADD CONSTRAINT "veto_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veto" ADD CONSTRAINT "veto_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_feedback" ADD CONSTRAINT "board_feedback_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_feedback" ADD CONSTRAINT "board_feedback_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_reaction" ADD CONSTRAINT "item_reaction_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_reaction" ADD CONSTRAINT "item_reaction_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_reaction" ADD CONSTRAINT "item_reaction_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_click" ADD CONSTRAINT "outbound_click_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_swap" ADD CONSTRAINT "pick_swap_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_swap" ADD CONSTRAINT "pick_swap_from_item_id_catalogue_item_id_fk" FOREIGN KEY ("from_item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_swap" ADD CONSTRAINT "pick_swap_to_item_id_catalogue_item_id_fk" FOREIGN KEY ("to_item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_swap" ADD CONSTRAINT "pick_swap_by_participant_id_participant_id_fk" FOREIGN KEY ("by_participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_item_id_catalogue_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalogue_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis" ADD CONSTRAINT "synthesis_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogue_item_embedding_idx" ON "catalogue_item" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "catalogue_item_status_idx" ON "catalogue_item" USING btree ("status","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_project_user_unique" ON "participant" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "participant_host_idx" ON "participant" USING btree ("host_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "swipe_client_id_unique" ON "swipe" USING btree ("client_id");