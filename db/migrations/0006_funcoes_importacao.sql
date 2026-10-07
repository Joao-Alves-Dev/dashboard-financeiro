-- Importação atômica e desfazer. `security invoker`: rodam com os privilégios de app_user (sem BYPASSRLS),
-- então o RLS de lancamentos/importacoes/contas se aplica dentro das funções. Ainda assim validam tudo.
-- Erros: 28000 sem usuário, 42501 sem acesso ao workspace, 22023 parâmetro inválido, P0002 não encontrada.
create function public.importar_lancamentos(
  p_ws uuid,
  p_conta uuid,
  p_arquivo text,
  p_formato text,
  p_linhas jsonb
) returns table (importacao_id uuid, inseridos int, ignorados int)
  language plpgsql security invoker
  set search_path = public
as $$
#variable_conflict use_column
declare
  v_user text := public.usuario_atual();
  v_arquivo text := btrim(coalesce(p_arquivo, ''));
  v_total int;
  v_imp uuid := gen_random_uuid();
  v_ins int;
  v_el jsonb;
  v_ord bigint;
  v_valor numeric;
  v_cat text;
begin
  if v_user is null then
    raise exception 'usuário não identificado' using errcode = '28000';
  end if;
  if p_ws is null or p_conta is null then
    raise exception 'workspace e conta são obrigatórios' using errcode = '22023';
  end if;
  if not public.is_member(p_ws) then
    raise exception 'sem acesso ao workspace' using errcode = '42501';
  end if;
  if not exists (select 1 from public.contas c where c.id = p_conta and c.workspace_id = p_ws) then
    raise exception 'conta não pertence ao workspace' using errcode = '22023';
  end if;
  if p_formato is null or p_formato not in ('ofx', 'csv') then
    raise exception 'formato inválido: %', p_formato using errcode = '22023';
  end if;
  if char_length(v_arquivo) not between 1 and 255 then
    raise exception 'nome de arquivo inválido' using errcode = '22023';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'linhas deve ser um array' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_linhas);
  if v_total = 0 then
    raise exception 'nenhuma linha para importar' using errcode = '22023';
  end if;
  if v_total > 5000 then
    raise exception 'limite de 5000 linhas por importação excedido' using errcode = '22023';
  end if;

  -- Validação completa antes de gravar: qualquer linha inválida aborta tudo.
  for v_el, v_ord in select e.el, e.ord from jsonb_array_elements(p_linhas) with ordinality as e(el, ord) loop
    if jsonb_typeof(v_el) <> 'object' then
      raise exception 'linha %: formato inválido', v_ord using errcode = '22023';
    end if;
    if jsonb_typeof(v_el -> 'data') <> 'string' or (v_el ->> 'data') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'linha %: data inválida', v_ord using errcode = '22023';
    end if;
    begin
      perform (v_el ->> 'data')::date;
    exception when others then
      raise exception 'linha %: data inválida', v_ord using errcode = '22023';
    end;
    if jsonb_typeof(v_el -> 'descricao') <> 'string' or btrim(v_el ->> 'descricao') = ''
       or char_length(btrim(v_el ->> 'descricao')) > 500 then
      raise exception 'linha %: descrição inválida', v_ord using errcode = '22023';
    end if;
    if jsonb_typeof(v_el -> 'valorCentavos') <> 'number' then
      raise exception 'linha %: valor inválido', v_ord using errcode = '22023';
    end if;
    v_valor := (v_el ->> 'valorCentavos')::numeric;
    if v_valor <> trunc(v_valor) or v_valor = 0 or abs(v_valor) > 9000000000000000 then
      raise exception 'linha %: valor inválido', v_ord using errcode = '22023';
    end if;
    if jsonb_typeof(v_el -> 'idExterno') <> 'string' or btrim(v_el ->> 'idExterno') = ''
       or char_length(v_el ->> 'idExterno') > 200 then
      raise exception 'linha %: id externo inválido', v_ord using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(v_el -> 'categoriaId'), 'null') <> 'null' then
      if jsonb_typeof(v_el -> 'categoriaId') <> 'string'
         or (v_el ->> 'categoriaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'linha %: categoria inválida', v_ord using errcode = '22023';
      end if;
      v_cat := v_el ->> 'categoriaId';
      if not exists (select 1 from public.categorias c where c.id = v_cat::uuid and c.workspace_id = p_ws) then
        raise exception 'linha %: categoria não pertence ao workspace', v_ord using errcode = '22023';
      end if;
    end if;
  end loop;

  insert into public.importacoes (id, workspace_id, conta_id, arquivo_nome, formato, qtd_lancamentos)
  values (v_imp, p_ws, p_conta, v_arquivo, p_formato, 0);

  insert into public.lancamentos
    (workspace_id, conta_id, categoria_id, data, descricao, valor_centavos, status, id_externo, importacao_id)
  select p_ws,
         p_conta,
         nullif(e.el ->> 'categoriaId', '')::uuid,
         (e.el ->> 'data')::date,
         btrim(e.el ->> 'descricao'),
         (e.el ->> 'valorCentavos')::numeric::bigint,
         'efetivado',
         e.el ->> 'idExterno',
         v_imp
  from jsonb_array_elements(p_linhas) with ordinality as e(el, ord)
  order by e.ord
  on conflict (conta_id, id_externo) do nothing;
  get diagnostics v_ins = row_count;

  if v_ins = 0 then
    -- tudo já existia: não deixa importação vazia
    delete from public.importacoes where id = v_imp;
    return query select null::uuid, 0, v_total;
  else
    update public.importacoes set qtd_lancamentos = v_ins where id = v_imp;
    return query select v_imp, v_ins, v_total - v_ins;
  end if;
end
$$;
--> statement-breakpoint
create function public.desfazer_importacao(p_id uuid) returns void
  language plpgsql security invoker
  set search_path = public
as $$
#variable_conflict use_column
declare
  v_ws uuid;
begin
  if public.usuario_atual() is null then
    raise exception 'usuário não identificado' using errcode = '28000';
  end if;
  if p_id is null then
    raise exception 'importação é obrigatória' using errcode = '22023';
  end if;
  -- RLS: só enxerga importações dos workspaces do usuário
  select i.workspace_id into v_ws from public.importacoes i where i.id = p_id;
  if v_ws is null then
    raise exception 'importação não encontrada' using errcode = 'P0002';
  end if;
  delete from public.lancamentos l where l.importacao_id = p_id and l.workspace_id = v_ws;
  delete from public.importacoes i where i.id = p_id and i.workspace_id = v_ws;
end
$$;
--> statement-breakpoint
revoke all on function public.importar_lancamentos(uuid, uuid, text, text, jsonb) from public;
--> statement-breakpoint
revoke all on function public.desfazer_importacao(uuid) from public;
--> statement-breakpoint
grant execute on function public.importar_lancamentos(uuid, uuid, text, text, jsonb) to app_user;
--> statement-breakpoint
grant execute on function public.desfazer_importacao(uuid) to app_user;
