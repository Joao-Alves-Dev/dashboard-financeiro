-- security definer: roda como dono (BYPASSRLS), por isso valida tudo por conta própria.
create function public.criar_workspace(p_nome text, p_tipo text) returns uuid
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_user text := public.usuario_atual();
  v_ws uuid := gen_random_uuid();
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  if v_user is null then
    raise exception 'usuário não identificado' using errcode = '28000';
  end if;
  if not exists (select 1 from public."user" where id = v_user) then
    raise exception 'usuário inexistente' using errcode = '28000';
  end if;
  if p_tipo is null or p_tipo not in ('pessoal', 'empresa') then
    raise exception 'tipo de workspace inválido: %', p_tipo using errcode = '22023';
  end if;
  if char_length(v_nome) not between 1 and 120 then
    raise exception 'nome de workspace inválido' using errcode = '22023';
  end if;

  insert into public.workspaces (id, nome, tipo, criado_por) values (v_ws, v_nome, p_tipo, v_user);
  insert into public.workspace_members (workspace_id, user_id, papel) values (v_ws, v_user, 'dono');

  if p_tipo = 'pessoal' then
    insert into public.categorias (workspace_id, nome, natureza, cor)
    select v_ws, c.nome, c.natureza, c.cor from (values
      ('Salário', 'receita', '#16a34a'),
      ('Outras receitas', 'receita', '#22c55e'),
      ('Moradia', 'despesa', '#6366f1'),
      ('Alimentação', 'despesa', '#f59e0b'),
      ('Transporte', 'despesa', '#0ea5e9'),
      ('Saúde', 'despesa', '#ef4444'),
      ('Lazer', 'despesa', '#ec4899'),
      ('Educação', 'despesa', '#8b5cf6'),
      ('Outros', 'despesa', '#64748b')
    ) as c(nome, natureza, cor);
  else
    insert into public.categorias (workspace_id, nome, natureza, cor)
    select v_ws, c.nome, c.natureza, c.cor from (values
      ('Vendas', 'receita', '#16a34a'),
      ('Serviços', 'receita', '#22c55e'),
      ('Outras receitas', 'receita', '#84cc16'),
      ('Fornecedores', 'despesa', '#f59e0b'),
      ('Folha', 'despesa', '#6366f1'),
      ('Impostos', 'despesa', '#ef4444'),
      ('Aluguel', 'despesa', '#0ea5e9'),
      ('Marketing', 'despesa', '#ec4899'),
      ('Outros', 'despesa', '#64748b')
    ) as c(nome, natureza, cor);
  end if;

  return v_ws;
end
$$;
