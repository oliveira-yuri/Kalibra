CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"institution" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'Concurso Público' NOT NULL,
	"exam_date" date,
	"availability" jsonb NOT NULL,
	"status" "workspace_status" NOT NULL,
	"source_mode" text DEFAULT 'text' NOT NULL,
	"source_file_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_slug_por_usuario" UNIQUE("user_id","slug"),
	CONSTRAINT "workspace_usuario_id" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "cargo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"exam_date" date,
	"period" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL,
	CONSTRAINT "cargo_workspace_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "edital_source_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cargo_id" uuid,
	"text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"kind" "concept_kind" NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"status" "concept_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_slug_por_usuario" UNIQUE("user_id","slug"),
	CONSTRAINT "concept_usuario_id" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "syllabus_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"parent_item_id" uuid,
	"source_label" text NOT NULL,
	"source_excerpt" text,
	"page" integer,
	"confidence" real DEFAULT 1 NOT NULL,
	"uncertain" boolean DEFAULT false NOT NULL,
	CONSTRAINT "syllabus_item_workspace_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "syllabus_item_cargo" (
	"workspace_id" uuid NOT NULL,
	"syllabus_item_id" uuid NOT NULL,
	"cargo_id" uuid NOT NULL,
	"weight" real,
	"question_count" integer,
	CONSTRAINT "syllabus_item_cargo_workspace_id_syllabus_item_id_cargo_id_pk" PRIMARY KEY("workspace_id","syllabus_item_id","cargo_id")
);
--> statement-breakpoint
CREATE TABLE "approval_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"type" "approval_type" NOT NULL,
	"status" "approval_status" NOT NULL,
	"title" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"source_ref" text,
	"target_concept_id" uuid,
	"confidence" real,
	"payload_before" jsonb,
	"payload_after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edital_source_block" ADD CONSTRAINT "edital_source_block_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edital_source_block" ADD CONSTRAINT "bloco_cargo_do_mesmo_workspace" FOREIGN KEY ("workspace_id","cargo_id") REFERENCES "public"."cargo"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept" ADD CONSTRAINT "concept_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept" ADD CONSTRAINT "concept_pai_do_mesmo_usuario" FOREIGN KEY ("user_id","parent_id") REFERENCES "public"."concept"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item" ADD CONSTRAINT "syllabus_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item" ADD CONSTRAINT "syllabus_item_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item" ADD CONSTRAINT "syllabus_item_pai_do_mesmo_workspace" FOREIGN KEY ("workspace_id","parent_item_id") REFERENCES "public"."syllabus_item"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" ADD CONSTRAINT "syllabus_item_cargo_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" ADD CONSTRAINT "ligacao_item_do_mesmo_workspace" FOREIGN KEY ("workspace_id","syllabus_item_id") REFERENCES "public"."syllabus_item"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" ADD CONSTRAINT "ligacao_cargo_do_mesmo_workspace" FOREIGN KEY ("workspace_id","cargo_id") REFERENCES "public"."cargo"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_item" ADD CONSTRAINT "approval_item_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_item" ADD CONSTRAINT "aprovacao_conceito_do_mesmo_usuario" FOREIGN KEY ("user_id","target_concept_id") REFERENCES "public"."concept"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_item" ADD CONSTRAINT "aprovacao_workspace_do_mesmo_usuario" FOREIGN KEY ("user_id","workspace_id") REFERENCES "public"."workspace"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cargo_um_selecionado_por_workspace" ON "cargo" USING btree ("workspace_id") WHERE "cargo"."is_selected";