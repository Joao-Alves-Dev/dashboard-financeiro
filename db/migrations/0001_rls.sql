create function public.usuario_atual() returns text
  language sql stable
  set search_path = public
as $$ select nullif(current_setting('app.usuario_id', true), '') $$;
--> statement-breakpoint
-- security definer: roda como dono (que tem BYPASSRLS no Neon), o que evita recursão de RLS em workspace_members.
create function public.is_member(ws uuid) returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = public.usuario_atual()
  )
$$;
--> statement-breakpoint
alter table public.workspaces enable row level security;
--> statement-breakpoint
alter table public.workspaces force row level security;
--> statement-breakpoint
alter table public.workspace_members enable row level security;
--> statement-breakpoint
alter table public.workspace_members force row level security;
--> statement-breakpoint
alter table public.contas enable row level security;
--> statement-breakpoint
alter table public.contas force row level security;
--> statement-breakpoint
alter table public.categorias enable row level security;
--> statement-breakpoint
alter table public.categorias force row level security;
--> statement-breakpoint
alter table public.lancamentos enable row level security;
--> statement-breakpoint
alter table public.lancamentos force row level security;
--> statement-breakpoint
alter table public.regras_categoria enable row level security;
--> statement-breakpoint
alter table public.regras_categoria force row level security;
--> statement-breakpoint
alter table public.orcamentos enable row level security;
--> statement-breakpoint
alter table public.orcamentos force row level security;
--> statement-breakpoint
alter table public.importacoes enable row level security;
--> statement-breakpoint
alter table public.importacoes force row level security;
--> statement-breakpoint
-- workspaces: leitura e edição só para membros; INSERT sem policy (negado), só criar_workspace cria.
create policy workspaces_select on public.workspaces for select using (public.is_member(id));
--> statement-breakpoint
create policy workspaces_update on public.workspaces for update using (public.is_member(id)) with check (public.is_member(id));
--> statement-breakpoint
-- workspace_members: leitura dos próprios vínculos e dos colegas; escrita sem policy (negada).
create policy workspace_members_select on public.workspace_members for select
  using (user_id = public.usuario_atual() or public.is_member(workspace_id));
--> statement-breakpoint
create policy contas_all on public.contas for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy categorias_all on public.categorias for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy lancamentos_all on public.lancamentos for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy regras_categoria_all on public.regras_categoria for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy orcamentos_all on public.orcamentos for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
--> statement-breakpoint
create policy importacoes_all on public.importacoes for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
