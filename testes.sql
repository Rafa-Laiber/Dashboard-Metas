-- Testes do banco: regras de acesso, histórico de avanços e funções. Para no primeiro erro.
\set ON_ERROR_STOP on
\set rafa '11111111-1111-1111-1111-111111111111'
\set ana  '22222222-2222-2222-2222-222222222222'
\set tio  '33333333-3333-3333-3333-333333333333'

-- dados: meta do Rafa compartilhada com a Ana; histórico no formato antigo deve ir para a tabela nova
insert into metas (id, user_id, nome, tipo, atual, alvo, registros) values
 ('aaaaaaaa-0000-0000-0000-000000000001', :'rafa', 'Juntar', 'Numérica', 25, 100,
  '[{"id":"r1","valor":10,"data":"2026-10-01"},{"id":"r1","valor":15,"data":"2026-10-02"}]');
insert into meta_membros values ('aaaaaaaa-0000-0000-0000-000000000001', :'ana');
do $$ begin
  assert (select count(*) from avancos) = 2, 'histórico antigo deveria ir para avancos (com id repetido renomeado)';
  assert (select registros from metas limit 1) = '[]'::jsonb, 'coluna antiga deveria ficar vazia';
end $$;

-- Rafa: soma duas vezes com o mesmo id (conta uma só)
set role authenticated; set request.jwt.claim.sub = :'rafa';
select avanco_somar('aaaaaaaa-0000-0000-0000-000000000001', 'n1', 20, '2026-11-24');
select avanco_somar('aaaaaaaa-0000-0000-0000-000000000001', 'n1', 20, '2026-11-24');
do $$ begin assert (select atual from metas) = 45, 'soma repetida não pode duplicar'; end $$;

-- Ana (participante): vê, soma e apaga
set request.jwt.claim.sub = :'ana';
do $$ begin assert (select count(*) from avancos) = 3, 'participante deveria ver o histórico'; end $$;
select avanco_somar('aaaaaaaa-0000-0000-0000-000000000001', 'n2', 5, null);
select avanco_apagar('aaaaaaaa-0000-0000-0000-000000000001', 'n1');
do $$ begin assert (select atual from metas) = 30, 'participante deveria somar e apagar'; end $$;
do $$ begin
  delete from metas;  -- participante não apaga a meta
  assert (select count(*) from metas) = 1, 'participante não pode excluir a meta';
end $$;

-- Tio (sem acesso): não vê nem mexe
set request.jwt.claim.sub = :'tio';
do $$ begin
  assert (select count(*) from metas) = 0, 'estranho não pode ver metas';
  assert (select count(*) from avancos) = 0, 'estranho não pode ver avanços';
  begin
    perform avanco_somar('aaaaaaaa-0000-0000-0000-000000000001', 'x', 999, null);
    raise exception 'estranho conseguiu somar';
  exception when insufficient_privilege or others then
    if sqlerrm = 'estranho conseguiu somar' then raise; end if;
  end;
  delete from avancos; update metas set atual = 0;
end $$;
reset role;
do $$ begin assert (select atual from metas) = 30 and (select count(*) from avancos) = 3, 'estranho alterou dados'; end $$;

-- ninguém troca o dono; apagar a meta apaga o histórico
set role authenticated; set request.jwt.claim.sub = :'rafa';
do $$ begin
  begin update metas set user_id = '22222222-2222-2222-2222-222222222222'; raise exception 'dono trocado';
  exception when others then if sqlerrm = 'dono trocado' then raise; end if; end;
end $$;
delete from metas;
reset role;
do $$ begin assert (select count(*) from avancos) = 0, 'histórico deveria sumir junto com a meta'; end $$;

-- visitante sem login não acessa nada
set role anon;
do $$ begin
  begin perform count(*) from metas; raise exception 'anon leu metas';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo 'Banco: todos os testes passaram.'
