CREATE TYPE "public"."source_mode" AS ENUM('file', 'text', 'none');--> statement-breakpoint
ALTER TABLE "workspace" ALTER COLUMN "source_mode" SET DEFAULT 'text'::"public"."source_mode";--> statement-breakpoint
ALTER TABLE "workspace" ALTER COLUMN "source_mode" SET DATA TYPE "public"."source_mode" USING "source_mode"::"public"."source_mode";