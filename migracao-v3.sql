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
