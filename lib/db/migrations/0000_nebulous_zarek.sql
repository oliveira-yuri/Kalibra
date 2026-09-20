CREATE TYPE "public"."approval_status" AS ENUM('pendente', 'revisando', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('edital_structure', 'concept_merge');--> statement-breakpoint
CREATE TYPE "public"."concept_kind" AS ENUM('disciplina', 'topico', 'subtopico');--> statement-breakpoint
CREATE TYPE "public"."concept_status" AS ENUM('confirmed', 'provisional');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('sem_edital', 'aguardando_upload', 'extraindo_edital', 'aguardando_revisao_edital', 'diagnostico_pendente', 'diagnostico_em_andamento', 'plano_quinzenal_pendente', 'estudando', 'erro');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
