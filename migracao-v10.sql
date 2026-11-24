-- Metas · atualização v10: histórico de avanços sem limite
-- Rode uma vez no Supabase (SQL Editor > New query > cole tudo > Run). Pode rodar de novo sem problema.

-- 1) Cópia de segurança do histórico como está hoje (antes de mexer) ------------
create table if not exists public.registros_backup_v10 (
  meta_id    uuid primary key,
  registros  jsonb not null,
  copiado_em timestamptz not null default now()
);
alter table public.registros_backup_v10 enable row level security; -- ninguém lê pela API
insert into public.registros_backup_v10 (meta_id, registros)
select id, registros from public.metas
where jsonb_typeof(registros) = 'array' and jsonb_array_length(registros) > 0
on conflict (meta_id) do nothing;

-- 2) Tabela própria para os avanços --------------------------------------------
create table if not exists public.avancos (
  meta_id   uuid not null references public.metas(id) on delete cascade,
  id        text not null,
  valor     double precision not null,
  data      date not null default current_date,
  user_id   uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (meta_id, id)
);
create index if not exists avancos_meta_data_idx on public.avancos (meta_id, data, criado_em);
alter table public.avancos enable row level security;

-- quem vê a meta (dono ou participante) vê e mexe no histórico dela
drop policy if exists "ver avancos" on public.avancos;
create policy "ver avancos" on public.avancos for select to authenticated
  using (exists (select 1 from public.metas m where m.id = meta_id));
drop policy if exists "criar avancos" on public.avancos;
create policy "criar avancos" on public.avancos for insert to authenticated
  with check (exists (select 1 from public.metas m where m.id = meta_id));
drop policy if exists "apagar avancos" on public.avancos;
create policy "apagar avancos" on public.avancos for delete to authenticated
  using (exists (select 1 from public.metas m where m.id = meta_id));

-- 3) Move para a tabela nova qualquer histórico que chegar no formato antigo ----
--    (backup restaurado, ou um aparelho que ainda está com a versão antiga aberta)
create or replace function public.mover_registros(p_meta uuid, p_dono uuid, p_regs jsonb, p_base timestamptz)
returns void language plpgsql set search_path = '' as $$
begin
  if p_regs is null or jsonb_typeof(p_regs) <> 'array' or jsonb_array_length(p_regs) = 0 then return; end if;
  insert into public.avancos (meta_id, id, valor, data, user_id, criado_em)
  select p_meta,
         case when n > 1 then rid || '-' || ord else rid end,
         valor, data, coalesce((select auth.uid()), p_dono), p_base + ord * interval '1 millisecond'
  from (
    select ord,
           coalesce(nullif(r->>'id', ''), 'r' || ord) as rid,
           row_number() over (partition by coalesce(nullif(r->>'id', ''), 'r' || ord) order by ord) as n,
           case when jsonb_typeof(r->'valor') = 'number' then (r->>'valor')::double precision
                when (r->>'valor') ~ '^-?[0-9]+(\.[0-9]+)?$' then (r->>'valor')::double precision
                end as valor,
           case when (r->>'data') ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'data')::date else current_date end as data
    from jsonb_array_elements(p_regs) with ordinality as t(r, ord)
    where jsonb_typeof(r) = 'object'
  ) x
  where valor is not null
  on conflict (meta_id, id) do nothing;
end $$;

create or replace function public.metas_registros_antes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.registros) = 'array' and jsonb_array_length(new.registros) > 0 then
    perform public.mover_registros(new.id, new.user_id, new.registros, now());
    new.registros := '[]'::jsonb;
  end if;
  return new;
end $$;
drop trigger if exists metas_registros_upd on public.metas;
create trigger metas_registros_upd before update on public.metas
  for each row execute function public.metas_registros_antes();

create or replace function public.metas_registros_depois() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.registros) = 'array' and jsonb_array_length(new.registros) > 0 then
    update public.metas set registros = registros where id = new.id; -- dispara o gatilho acima
  end if;
  return null;
end $$;
drop trigger if exists metas_registros_ins on public.metas;
create trigger metas_registros_ins after insert on public.metas
  for each row execute function public.metas_registros_depois();

-- 4) Muda o histórico atual de lugar (usa o gatilho acima) ------------------------
--    a ordem é mantida: cada avanço ganha um horário um pouco depois da criação da meta
do $$
declare m record;
begin
  for m in select id, user_id, registros, created_at from public.metas
           where jsonb_typeof(registros) = 'array' and jsonb_array_length(registros) > 0 loop
    perform public.mover_registros(m.id, m.user_id, m.registros, m.created_at);
  end loop;
end $$;
alter table public.metas disable trigger metas_updated_at;
update public.metas set registros = '[]'::jsonb
where jsonb_typeof(registros) = 'array' and jsonb_array_length(registros) > 0;
alter table public.metas enable trigger metas_updated_at;

-- 5) Somar e apagar avanço numa operação só (não duplica se o app repetir) -------
create or replace function public.avanco_somar(p_meta uuid, p_id text, p_valor double precision, p_data date)
returns public.metas language plpgsql set search_path = '' as $$
declare r public.metas;
begin
  insert into public.avancos (meta_id, id, valor, data)
  values (p_meta, p_id, p_valor, coalesce(p_data, current_date))
  on conflict (meta_id, id) do nothing;
  if found then
    update public.metas set atual = round((coalesce(atual, 0) + p_valor)::numeric, 2)::double precision
    where id = p_meta returning * into r;
  else
    select * into r from public.metas where id = p_meta;
  end if;
  if r.id is null then raise exception 'Meta não encontrada' using errcode = 'P0002'; end if;
  return r;
end $$;

create or replace function public.avanco_apagar(p_meta uuid, p_id text)
returns public.metas language plpgsql set search_path = '' as $$
declare r public.metas; v double precision;
begin
  delete from public.avancos where meta_id = p_meta and id = p_id returning valor into v;
  if found then
    update public.metas set atual = round((coalesce(atual, 0) - v)::numeric, 2)::double precision
    where id = p_meta returning * into r;
  else
    select * into r from public.metas where id = p_meta;
  end if;
  if r.id is null then raise exception 'Meta não encontrada' using errcode = 'P0002'; end if;
  return r;
end $$;

-- 6) Permissões da API -------------------------------------------------------------
grant select, insert, delete on public.avancos to authenticated;
grant execute on function public.avanco_somar(uuid, text, double precision, date),
                          public.avanco_apagar(uuid, text) to authenticated;
revoke execute on function public.avanco_somar(uuid, text, double precision, date),
                           public.avanco_apagar(uuid, text) from anon;
notify pgrst, 'reload schema';
