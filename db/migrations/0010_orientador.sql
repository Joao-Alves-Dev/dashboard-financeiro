CREATE TABLE "alertas_dispensados" (
	"workspace_id" uuid NOT NULL,
	"regra_id" text NOT NULL,
	"chave" text NOT NULL,
	"mes" date NOT NULL,
	"severidade" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alertas_dispensados_workspace_id_regra_id_chave_mes_pk" PRIMARY KEY("workspace_id","regra_id","chave","mes"),
	CONSTRAINT "alertas_dispensados_mes_dia1_check" CHECK (extract(day from "alertas_dispensados"."mes") = 1),
	CONSTRAINT "alertas_dispensados_severidade_check" CHECK ("alertas_dispensados"."severidade" in ('critico', 'atencao', 'info', 'positivo')),
	CONSTRAINT "alertas_dispensados_regra_check" CHECK (char_length("alertas_dispensados"."regra_id") between 1 and 40),
	CONSTRAINT "alertas_dispensados_chave_check" CHECK (char_length("alertas_dispensados"."chave") <= 64)
);
--> statement-breakpoint
CREATE TABLE "config_orientador" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"limite_categoria_pct" integer DEFAULT 15 NOT NULL,
	"alta_pct" integer DEFAULT 30 NOT NULL,
	"cartao_pct" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "config_orientador_limite_categoria_check" CHECK ("config_orientador"."limite_categoria_pct" between 1 and 100),
	CONSTRAINT "config_orientador_alta_check" CHECK ("config_orientador"."alta_pct" between 1 and 500),
	CONSTRAINT "config_orientador_cartao_check" CHECK ("config_orientador"."cartao_pct" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "alertas_dispensados" ADD CONSTRAINT "alertas_dispensados_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_orientador" ADD CONSTRAINT "config_orientador_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS igual às demais tabelas de domínio (is_member por workspace_id).
alter table public.config_orientador enable row level security;
--> statement-breakpoint
alter table public.config_orientador force row level security;
--> statement-breakpoint
alter table public.alertas_dispensados enable row level security;
--> statement-breakpoint
alter table public.alertas_dispensados force row level security;
--> statement-breakpoint
create policy config_orientador_membros on public.config_orientador for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy alertas_dispensados_membros on public.alertas_dispensados for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
-- Os default privileges da 0003 já cobrem; explícito aqui para não depender deles.
grant select, insert, update, delete on public.config_orientador to app_user;
--> statement-breakpoint
grant select, insert, update, delete on public.alertas_dispensados to app_user;
