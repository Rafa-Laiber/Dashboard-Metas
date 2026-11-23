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
