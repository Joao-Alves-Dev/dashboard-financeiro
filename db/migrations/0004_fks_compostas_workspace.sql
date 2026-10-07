-- FKs compostas por workspace: conta/categoria/importação só podem ser referenciadas dentro do mesmo workspace.
-- `on delete set null (coluna)` (Postgres 15+) anula só a coluna nullable; workspace_id é NOT NULL.
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_workspace_id_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "contas" ADD CONSTRAINT "contas_workspace_id_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_workspace_id_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
ALTER TABLE "importacoes" DROP CONSTRAINT "importacoes_conta_id_contas_id_fk";
--> statement-breakpoint
ALTER TABLE "lancamentos" DROP CONSTRAINT "lancamentos_conta_id_contas_id_fk";
--> statement-breakpoint
ALTER TABLE "lancamentos" DROP CONSTRAINT "lancamentos_categoria_id_categorias_id_fk";
--> statement-breakpoint
ALTER TABLE "lancamentos" DROP CONSTRAINT "lancamentos_importacao_id_importacoes_id_fk";
--> statement-breakpoint
ALTER TABLE "orcamentos" DROP CONSTRAINT "orcamentos_categoria_id_categorias_id_fk";
--> statement-breakpoint
ALTER TABLE "regras_categoria" DROP CONSTRAINT "regras_categoria_categoria_id_categorias_id_fk";
--> statement-breakpoint
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_workspace_conta_fk" FOREIGN KEY ("workspace_id","conta_id") REFERENCES "public"."contas"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_workspace_conta_fk" FOREIGN KEY ("workspace_id","conta_id") REFERENCES "public"."contas"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_workspace_categoria_fk" FOREIGN KEY ("workspace_id","categoria_id") REFERENCES "public"."categorias"("workspace_id","id") ON DELETE set null ("categoria_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_workspace_importacao_fk" FOREIGN KEY ("workspace_id","importacao_id") REFERENCES "public"."importacoes"("workspace_id","id") ON DELETE set null ("importacao_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_workspace_categoria_fk" FOREIGN KEY ("workspace_id","categoria_id") REFERENCES "public"."categorias"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "regras_categoria" ADD CONSTRAINT "regras_categoria_workspace_categoria_fk" FOREIGN KEY ("workspace_id","categoria_id") REFERENCES "public"."categorias"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
