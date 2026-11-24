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
