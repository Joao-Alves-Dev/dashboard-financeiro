-- Funções de leitura do dashboard. Todas `security invoker` (rodam como app_user, sem BYPASSRLS: o RLS de
-- lancamentos/categorias/contas/orcamentos se aplica) e validam membership explicitamente (erro claro em vez de vazio).
-- Erros: 28000 sem usuário, 42501 sem acesso ao workspace, 22023 parâmetro inválido.
--
-- CONTRATO DE SINAIS (vale para todas as funções):
--   * só lançamentos com status = 'efetivado' entram; 'pendente' fica de fora de tudo aqui;
--   * `entradas`  = soma dos valor_centavos > 0                         (>= 0)
--   * `saidas`    = soma de |valor_centavos| dos valor_centavos < 0     (>= 0, valor POSITIVO)
--   * `resultado` = entradas - saidas                                    (pode ser negativo)
--   * `total` / `realizado` / `orcado` são sempre >= 0 (despesa como valor positivo)
--   * datas p_de/p_ate são inclusivas; meses são agrupados pela coluna `data` (tipo date, sem fuso).
create function public.exigir_membro(p_ws uuid) returns void
  language plpgsql stable security invoker
  set search_path = public
as $$
begin
  if public.usuario_atual() is null then
    raise exception 'usuário não identificado' using errcode = '28000';
  end if;
  if p_ws is null then
    raise exception 'workspace é obrigatório' using errcode = '22023';
  end if;
  if not public.is_member(p_ws) then
    raise exception 'sem acesso ao workspace' using errcode = '42501';
  end if;
end
$$;
--> statement-breakpoint
-- Um registro por mês de date_trunc('month', p_de) até date_trunc('month', p_ate), inclusive; meses sem
-- lançamentos retornam zeros. `mes` é o dia 1 do mês. Máximo de 120 meses.
create function public.resumo_mensal(p_ws uuid, p_de date, p_ate date)
  returns table (mes date, entradas bigint, saidas bigint, resultado bigint)
  language plpgsql stable security invoker
  set search_path = public
as $$
#variable_conflict use_column
declare
  v_ini date;
  v_fim date;
begin
  perform public.exigir_membro(p_ws);
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'intervalo inválido' using errcode = '22023';
  end if;
  v_ini := date_trunc('month', p_de::timestamp)::date;
  v_fim := date_trunc('month', p_ate::timestamp)::date;
  if (extract(year from v_fim) - extract(year from v_ini)) * 12
     + extract(month from v_fim) - extract(month from v_ini) >= 120 then
    raise exception 'intervalo máximo de 120 meses' using errcode = '22023';
  end if;

  return query
  with meses as (
    select g::date as m
    from generate_series(v_ini::timestamp, v_fim::timestamp, interval '1 month') as g
  ),
  agg as (
    select date_trunc('month', l.data::timestamp)::date as m,
           sum(case when l.valor_centavos > 0 then l.valor_centavos else 0 end) as e,
           sum(case when l.valor_centavos < 0 then -l.valor_centavos else 0 end) as s
    from public.lancamentos l
    where l.workspace_id = p_ws
      and l.status = 'efetivado'
      and l.data >= v_ini
      and l.data < (v_fim::timestamp + interval '1 month')::date
    group by 1
  )
  select ms.m,
         coalesce(a.e, 0)::bigint,
         coalesce(a.s, 0)::bigint,
         (coalesce(a.e, 0) - coalesce(a.s, 0))::bigint
  from meses ms
  left join agg a on a.m = ms.m
  order by ms.m;
end
$$;
--> statement-breakpoint
-- Saídas efetivadas no intervalo (inclusivo) por categoria; `total` positivo; sem categoria -> categoria_id nulo e
-- nome 'Sem categoria' (cor cinza neutra). Ordem: total desc, nome.
create function public.gastos_por_categoria(p_ws uuid, p_de date, p_ate date)
  returns table (categoria_id uuid, nome text, cor text, total bigint)
  language plpgsql stable security invoker
  set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.exigir_membro(p_ws);
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'intervalo inválido' using errcode = '22023';
  end if;

  return query
  select c.id,
         coalesce(c.nome, 'Sem categoria'),
         coalesce(c.cor, '#64748b'),
         sum(-l.valor_centavos)::bigint
  from public.lancamentos l
  left join public.categorias c on c.id = l.categoria_id and c.workspace_id = l.workspace_id
  where l.workspace_id = p_ws
    and l.status = 'efetivado'
    and l.valor_centavos < 0
    and l.data >= p_de
    and l.data <= p_ate
  group by c.id, c.nome, c.cor
  order by sum(-l.valor_centavos) desc, coalesce(c.nome, 'Sem categoria');
end
$$;
--> statement-breakpoint
-- Para cada categoria de natureza 'despesa' com orçamento no mês OU com gasto (saída efetivada) no mês.
-- p_mes é normalizado para o dia 1. `orcado` = 0 quando não há orçamento; `realizado` positivo;
-- `percentual` = realizado * 100 / orcado (2 casas), nulo quando orcado é 0/ausente.
create function public.orcamento_vs_realizado(p_ws uuid, p_mes date)
  returns table (categoria_id uuid, nome text, orcado bigint, realizado bigint, percentual numeric)
  language plpgsql stable security invoker
  set search_path = public
as $$
#variable_conflict use_column
declare
  v_mes date;
begin
  perform public.exigir_membro(p_ws);
  if p_mes is null then
    raise exception 'mês é obrigatório' using errcode = '22023';
  end if;
  v_mes := date_trunc('month', p_mes::timestamp)::date;

  return query
  with gasto as (
    select l.categoria_id as cid, sum(-l.valor_centavos) as g
    from public.lancamentos l
    where l.workspace_id = p_ws
      and l.status = 'efetivado'
      and l.valor_centavos < 0
      and l.categoria_id is not null
      and l.data >= v_mes
      and l.data < (v_mes::timestamp + interval '1 month')::date
    group by l.categoria_id
  ),
  orc as (
    select o.categoria_id as cid, o.valor_centavos as v
    from public.orcamentos o
    where o.workspace_id = p_ws and o.mes = v_mes
  )
  select c.id,
         c.nome,
         coalesce(o.v, 0)::bigint,
         coalesce(g.g, 0)::bigint,
         case when coalesce(o.v, 0) > 0 then round(coalesce(g.g, 0) * 100.0 / o.v, 2) else null end
  from public.categorias c
  left join orc o on o.cid = c.id
  left join gasto g on g.cid = c.id
  where c.workspace_id = p_ws
    and c.natureza = 'despesa'
    and (o.cid is not null or g.cid is not null)
  order by coalesce(g.g, 0) desc, c.nome;
end
$$;
--> statement-breakpoint
-- Saldo atual = soma dos saldo_inicial_centavos das contas + soma de TODOS os lançamentos efetivados (qualquer data,
-- inclusive futuros já marcados como efetivados); pendentes ficam de fora. Pode ser negativo.
create function public.saldo_atual(p_ws uuid) returns bigint
  language plpgsql stable security invoker
  set search_path = public
as $$
begin
  perform public.exigir_membro(p_ws);
  return (
    coalesce((select sum(c.saldo_inicial_centavos) from public.contas c where c.workspace_id = p_ws), 0)
    + coalesce((select sum(l.valor_centavos) from public.lancamentos l
                where l.workspace_id = p_ws and l.status = 'efetivado'), 0)
  )::bigint;
end
$$;
--> statement-breakpoint
revoke all on function public.exigir_membro(uuid) from public;
--> statement-breakpoint
revoke all on function public.resumo_mensal(uuid, date, date) from public;
--> statement-breakpoint
revoke all on function public.gastos_por_categoria(uuid, date, date) from public;
--> statement-breakpoint
revoke all on function public.orcamento_vs_realizado(uuid, date) from public;
--> statement-breakpoint
revoke all on function public.saldo_atual(uuid) from public;
--> statement-breakpoint
grant execute on function public.exigir_membro(uuid) to app_user;
--> statement-breakpoint
grant execute on function public.resumo_mensal(uuid, date, date) to app_user;
--> statement-breakpoint
grant execute on function public.gastos_por_categoria(uuid, date, date) to app_user;
--> statement-breakpoint
grant execute on function public.orcamento_vs_realizado(uuid, date) to app_user;
--> statement-breakpoint
grant execute on function public.saldo_atual(uuid) to app_user;
