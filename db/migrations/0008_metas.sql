CREATE TABLE "aportes_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meta_id" uuid NOT NULL,
	"data" date NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aportes_meta_valor_check" CHECK ("aportes_meta"."valor_centavos" <> 0),
	CONSTRAINT "aportes_meta_observacao_check" CHECK ("aportes_meta"."observacao" is null or char_length("aportes_meta"."observacao") <= 200)
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"valor_alvo_centavos" bigint NOT NULL,
	"data_alvo" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	CONSTRAINT "metas_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "metas_nome_check" CHECK (char_length("metas"."nome") between 1 and 80),
	CONSTRAINT "metas_valor_alvo_check" CHECK ("metas"."valor_alvo_centavos" > 0)
);
--> statement-breakpoint
ALTER TABLE "aportes_meta" ADD CONSTRAINT "aportes_meta_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aportes_meta" ADD CONSTRAINT "aportes_meta_workspace_meta_fk" FOREIGN KEY ("workspace_id","meta_id") REFERENCES "public"."metas"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aportes_meta_workspace_meta_data_idx" ON "aportes_meta" USING btree ("workspace_id","meta_id","data");--> statement-breakpoint
CREATE INDEX "metas_workspace_idx" ON "metas" USING btree ("workspace_id");--> statement-breakpoint
-- RLS igual às demais tabelas de domínio (is_member por workspace_id).
alter table public.metas enable row level security;
--> statement-breakpoint
alter table public.metas force row level security;
--> statement-breakpoint
alter table public.aportes_meta enable row level security;
--> statement-breakpoint
alter table public.aportes_meta force row level security;
--> statement-breakpoint
create policy metas_membros on public.metas for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy aportes_meta_membros on public.aportes_meta for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
-- Os default privileges da 0003 já cobrem; explícito aqui para não depender deles.
grant select, insert, update, delete on public.metas to app_user;
--> statement-breakpoint
grant select, insert, update, delete on public.aportes_meta to app_user;
