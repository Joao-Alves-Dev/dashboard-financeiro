-- Auditoria de segurança (2026-10-12): antes, qualquer membro atualizava qualquer coluna de `workspaces`
-- (inclusive `criado_por` e `tipo`). Agora o app_user só atualiza `nome`, e só como `dono` do workspace.
-- O app não atualiza `workspaces` em nenhum fluxo; o código atual funciona antes e depois desta migração.
-- security definer: roda como dono (BYPASSRLS no Neon), evitando recursão de RLS em workspace_members (como is_member).
create or replace function public.is_dono(ws uuid) returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = public.usuario_atual() and m.papel = 'dono'
  )
$$;
--> statement-breakpoint
revoke execute on function public.is_dono(uuid) from public;
--> statement-breakpoint
grant execute on function public.is_dono(uuid) to app_user;
--> statement-breakpoint
revoke update on public.workspaces from app_user;
--> statement-breakpoint
grant update (nome) on public.workspaces to app_user;
--> statement-breakpoint
drop policy if exists workspaces_update on public.workspaces;
--> statement-breakpoint
create policy workspaces_update on public.workspaces for update
  using (public.is_dono(id)) with check (public.is_dono(id));
