-- Metas: estrutura completa do banco (Supabase).
-- Para um projeto NOVO, rode este arquivo uma vez (SQL Editor > New query > Run).
-- Ele já inclui todas as atualizações (v3, v9, v10 e v12) e pode ser rodado de novo sem problema.
-- Quem já tem o site funcionando NÃO precisa rodar nada daqui.

-- ================================================================ schema.sql
-- Metas 2027: rode este script uma vez no Supabase (SQL Editor > New query > Run).

create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null default 'Nova meta',
  area        text not null default 'Pessoal e família',
  tipo        text not null default 'Etapas' check (tipo in ('Numérica','Etapas','Marco único')),
  prioridade  text not null default 'Média'  check (prioridade in ('Alta','Média','Baixa')),
  status      text not null default 'Não iniciada' check (status in ('Não iniciada','Em andamento','Concluída','Pausada')),
  prazo       date,
  atual       double precision not null default 0,
  alvo        double precision not null default 0,
  unidade     text not null default '',
  notas       text not null default '',
  ordem       integer not null default 0,
  etapas      jsonb not null default '[]'::jsonb,
  registros   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists metas_user_idx on public.metas(user_id);

-- Atualiza updated_at a cada alteração
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists metas_updated_at on public.metas;
create trigger metas_updated_at before update on public.metas
for each row execute function public.set_updated_at();

-- Segurança: cada usuário só vê e altera as próprias metas
alter table public.metas enable row level security;

drop policy if exists "ler as proprias metas" on public.metas;
create policy "ler as proprias metas" on public.metas
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "criar as proprias metas" on public.metas;
create policy "criar as proprias metas" on public.metas
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "alterar as proprias metas" on public.metas;
create policy "alterar as proprias metas" on public.metas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "apagar as proprias metas" on public.metas;
create policy "apagar as proprias metas" on public.metas
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Usada pela tarefa automática do GitHub para manter o projeto ativo (não expõe dados)
create or replace function public.ping() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.metas where false;
$$;
grant execute on function public.ping() to anon;

-- Permissões de acesso pela API (projetos novos do Supabase não dão isso sozinhos).
-- As regras acima (RLS) continuam garantindo que cada pessoa só veja as próprias metas.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.metas to authenticated;
grant execute on function public.ping() to anon;
notify pgrst, 'reload schema';

-- ================================================================ migracao-v3.sql
-- Metas: atualização v3 (metas compartilhadas + hábitos semanais)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema: o script não duplica nada.

-- 1) Hábitos semanais: novos campos e novo tipo -------------------------------
alter table public.metas add column if not exists vezes integer not null default 3;
alter table public.metas add column if not exists dias  jsonb   not null default '[]'::jsonb;
alter table public.metas drop constraint if exists metas_tipo_check;
alter table public.metas add constraint metas_tipo_check
  check (tipo in ('Numérica','Etapas','Marco único','Hábito semanal'));

-- 2) Perfis da família (nome e e-mail, para escolher com quem compartilhar) ---
create table if not exists public.perfis (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  nome  text not null default ''
);

create or replace function public.sync_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nome', ''))
  on conflict (id) do update set email = excluded.email, nome = excluded.nome;
  return new;
end $$;

drop trigger if exists on_auth_user_sync on auth.users;
create trigger on_auth_user_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_perfil();

-- copia quem já existe
insert into public.perfis (id, email, nome)
select id, coalesce(email, ''), coalesce(raw_user_meta_data->>'nome', '') from auth.users
on conflict (id) do update set email = excluded.email, nome = excluded.nome;

alter table public.perfis enable row level security;
drop policy if exists "familia ve os perfis" on public.perfis;
create policy "familia ve os perfis" on public.perfis
  for select to authenticated using (true);

-- 3) Quem participa de cada meta compartilhada ---------------------------------
create table if not exists public.meta_membros (
  meta_id uuid not null references public.metas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (meta_id, user_id)
);
alter table public.meta_membros enable row level security;

create or replace function public.sou_dono(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.metas where id = m and user_id = (select auth.uid()));
$$;
create or replace function public.sou_membro(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.meta_membros where meta_id = m and user_id = (select auth.uid()));
$$;

drop policy if exists "ver participantes" on public.meta_membros;
create policy "ver participantes" on public.meta_membros
  for select to authenticated using (user_id = (select auth.uid()) or public.sou_dono(meta_id));
drop policy if exists "dono adiciona participantes" on public.meta_membros;
create policy "dono adiciona participantes" on public.meta_membros
  for insert to authenticated with check (public.sou_dono(meta_id) and user_id <> (select auth.uid()));
drop policy if exists "dono remove ou participante sai" on public.meta_membros;
create policy "dono remove ou participante sai" on public.meta_membros
  for delete to authenticated using (public.sou_dono(meta_id) or user_id = (select auth.uid()));

-- 4) Metas: participantes também podem ver e editar (só o dono apaga) ----------
drop policy if exists "ler as proprias metas" on public.metas;
drop policy if exists "ler metas proprias ou compartilhadas" on public.metas;
create policy "ler metas proprias ou compartilhadas" on public.metas
  for select to authenticated using ((select auth.uid()) = user_id or public.sou_membro(id));

drop policy if exists "alterar as proprias metas" on public.metas;
drop policy if exists "alterar metas proprias ou compartilhadas" on public.metas;
create policy "alterar metas proprias ou compartilhadas" on public.metas
  for update to authenticated
  using ((select auth.uid()) = user_id or public.sou_membro(id))
  with check ((select auth.uid()) = user_id or public.sou_membro(id));

-- ninguém pode trocar o dono de uma meta
create or replace function public.manter_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'O dono da meta não pode ser alterado';
  end if;
  return new;
end $$;
drop trigger if exists metas_manter_dono on public.metas;
create trigger metas_manter_dono before update on public.metas
  for each row execute function public.manter_dono();

-- 5) Permissões da API ---------------------------------------------------------
grant select on public.perfis to authenticated;
grant select, insert, delete on public.meta_membros to authenticated;
grant execute on function public.sou_dono(uuid), public.sou_membro(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ================================================================ migracao-v9.sql
-- Metas: atualização v9 (cor do perfil e data de conclusão das metas)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema.

-- 1) Data em que a meta foi concluída (usada no resumo semanal)
alter table public.metas add column if not exists concluida_em date;
-- metas que já estavam concluídas recebem a data da última alteração
update public.metas set concluida_em = updated_at::date
 where status = 'Concluída' and concluida_em is null;

-- 2) Cor do avatar, visível para a família ao compartilhar metas
alter table public.perfis add column if not exists cor integer not null default 0;

create or replace function public.sync_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c integer := 0;
begin
  if coalesce(new.raw_user_meta_data->>'cor', '') ~ '^[0-9]{1,2}$' then
    c := (new.raw_user_meta_data->>'cor')::integer;
  end if;
  insert into public.perfis (id, email, nome, cor)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nome', ''), c)
  on conflict (id) do update set email = excluded.email, nome = excluded.nome, cor = excluded.cor;
  return new;
end $$;

-- atualiza quem já existe
insert into public.perfis (id, email, nome, cor)
select id, coalesce(email, ''), coalesce(raw_user_meta_data->>'nome', ''),
       case when coalesce(raw_user_meta_data->>'cor', '') ~ '^[0-9]{1,2}$' then (raw_user_meta_data->>'cor')::integer else 0 end
from auth.users
on conflict (id) do update set email = excluded.email, nome = excluded.nome, cor = excluded.cor;

notify pgrst, 'reload schema';

-- ================================================================ migracao-v10.sql
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

-- ================================================================ migracao-v12.sql
-- Metas · atualização v12: metas compartilhadas ao vivo
-- Rode uma vez no Supabase (SQL Editor > New query > cole tudo > Run). Pode rodar de novo sem problema.

-- 1) Guarda quem fez a última alteração em cada meta (para avisar "Ana atualizou ...")
alter table public.metas add column if not exists alterado_por uuid;

create or replace function public.metas_marcar_autor() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.alterado_por := (select auth.uid());
  return new;
end $$;
drop trigger if exists metas_autor on public.metas;
create trigger metas_autor before insert or update on public.metas
  for each row execute function public.metas_marcar_autor();

-- 2) Liga o "ao vivo" (Realtime) para as metas, o histórico e o compartilhamento.
--    Cada pessoa só recebe mudanças das metas que ela pode ver (mesmas regras de acesso de sempre).
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['metas', 'avancos', 'meta_membros'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
