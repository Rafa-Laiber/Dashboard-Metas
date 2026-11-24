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
