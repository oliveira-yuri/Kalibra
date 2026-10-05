--> O id do cargo passa a ser identidade LOCAL ao workspace, escolhida por quem cria.
--> Ver lib/db/src/schema/cargo.ts para o porquê: `syllabus_item_cargo` guarda
--> `cargo_id`, e enquanto o módulo de syllabus for local as ligações que ele grava
--> precisam casar com o cargo que a API conhece.
--> A ordem abaixo é manual de propósito. O drizzle-kit não soube o nome da PK antiga
--> e gerou o DROP comentado; além disso, as duas FKs compostas dependem do unique
--> que precisa cair, então elas saem primeiro e voltam no fim.
ALTER TABLE "edital_source_block" DROP CONSTRAINT "bloco_cargo_do_mesmo_workspace";--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" DROP CONSTRAINT "ligacao_cargo_do_mesmo_workspace";--> statement-breakpoint
ALTER TABLE "cargo" DROP CONSTRAINT "cargo_workspace_id";--> statement-breakpoint
ALTER TABLE "cargo" DROP CONSTRAINT "cargo_pkey";--> statement-breakpoint
ALTER TABLE "cargo" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cargo" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "edital_source_block" ALTER COLUMN "cargo_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" ALTER COLUMN "cargo_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_workspace_id_id_pk" PRIMARY KEY("workspace_id","id");--> statement-breakpoint
ALTER TABLE "edital_source_block" ADD CONSTRAINT "bloco_cargo_do_mesmo_workspace" FOREIGN KEY ("workspace_id","cargo_id") REFERENCES "public"."cargo"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_item_cargo" ADD CONSTRAINT "ligacao_cargo_do_mesmo_workspace" FOREIGN KEY ("workspace_id","cargo_id") REFERENCES "public"."cargo"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
