-- Imita o que o Supabase já tem pronto (papéis, auth.users e auth.uid()) para testar o banco fora dele.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','rafa@x.com','{"nome":"Rafael"}'),('22222222-2222-2222-2222-222222222222','ana@x.com','{}'),('33333333-3333-3333-3333-333333333333','tio@x.com','{}');
