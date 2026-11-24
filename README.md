# Metas — painel de metas da família

Um site grátis que funciona no celular (como um app) e no computador.
- **Site:** GitHub Pages
- **Dados e login:** Supabase (plano grátis)
- **Tarefas automáticas no GitHub:**
  - testes a cada envio de arquivos;
  - uma consulta a cada 3 dias, para o Supabase não pausar o projeto.

## Arquivos

| Arquivo / pasta | Para quê |
|---|---|
| `index.html` | A estrutura da página |
| `css/app.css` | O visual (cores, tamanhos, modo app no celular) |
| `js/tema.js` | Aplica o tema claro/escuro antes da página aparecer |
| `js/base.js` | Constantes, preferências e regras de progresso |
| `js/dados.js` | Banco: fila de salvamento (funciona sem internet) e histórico de avanços |
| `js/telas.js` | Desenho da tela: cartões, gráfico, ano e resumo da semana |
| `js/gaveta.js` | Gaveta de edição de uma meta |
| `js/eventos.js` | Cliques e toques |
| `js/perfil.js` | Perfil, aparência e Face ID |
| `js/inicio.js` | Login, carregar dados, exemplos e backup |
| `lib/` | Bibliotecas usadas pelo site (Supabase e arrastar cartões), guardadas aqui mesmo |
| `sw.js` | Deixa o site abrir sem internet e sempre buscar a versão mais nova |
| `config.js` | Endereço e chave do Supabase. **Nunca substitua este arquivo.** |
| `schema.sql` | Estrutura completa do banco, só para um projeto novo |
| `migracao-*.sql` | Atualizações já aplicadas; ficam como histórico |
| `testes/` | Testes automáticos (site e banco) |
| `.github/workflows/testes.yml` | Roda os testes a cada envio |
| `.github/workflows/manter-ativo.yml` | Mantém o Supabase ativo |

## Testes automáticos

A cada envio de arquivos, o GitHub testa sozinho:
- **o site**, no computador e no celular: login, metas, avanços, etapas, hábitos, funcionamento sem internet, backup e segurança;
- **o banco**, com as regras de quem vê e quem altera cada meta.

Os testes usam um banco de mentira e **não tocam nos seus dados**.

- Para ver o resultado: aba **Actions**. Verde ✔ significa que está tudo certo; vermelho ✘ significa que algo quebrou, e o GitHub avisa por e-mail.
- Para rodar de novo na mão: **Actions → Testes → Run workflow**.

## Projeto novo do zero

1. **Supabase:**
   - crie o projeto;
   - em **SQL Editor**, rode `schema.sql`;
   - crie os usuários em **Authentication → Users** (marque **Auto Confirm User**);
   - desligue **Allow new users to sign up**.
2. **`config.js`:** cole a **Project URL** e a chave **publishable/anon**. Nunca use a `service_role`.
3. **GitHub:**
   - envie os arquivos;
   - em **Settings → Pages**, escolha a branch **main** e a pasta **/ (root)**;
   - em **Settings → Secrets → Actions**, crie `SUPABASE_URL` e `SUPABASE_KEY`.
4. **Face ID:** no Supabase, em **Authentication**, o domínio dos passkeys (RP ID) deve ser `SEU-USUARIO.github.io`.

## Backup

O plano grátis do Supabase não faz backup automático. Uma vez por mês, em **Perfil → Baixar backup**, guarde o arquivo `.json`.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Aviso "alterações não salvas" | É falta de internet. O site tenta de novo sozinho; as alterações ficam guardadas no aparelho. |
| "Não consegui carregar suas metas" | O projeto pode estar pausado: no Supabase, clique em **Resume project**. |
| Atualização não aparece | Feche e abra o site de novo (com internet). |
| Aviso "Sem internet" | O site mostra o que estava salvo no aparelho; o que você registrar é enviado quando a conexão voltar. |
