CREATE TYPE "public"."risk_status" AS ENUM('active', 'survived', 'lost');--> statement-breakpoint
ALTER TABLE "brock" ADD COLUMN "risk" "risk_status";