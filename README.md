# Metas 2027 — seu painel de metas

Um site só seu, grátis, que abre no celular e no computador.
- **Site:** GitHub Pages (grátis)
- **Dados e login:** Supabase (plano grátis)
- **Tarefa automática:** a cada 3 dias o GitHub consulta o banco, para o Supabase não pausar o projeto por falta de uso

Arquivos:
| Arquivo | Para quê |
|---|---|
| `index.html` | O painel |
| `config.js` | Onde você cola o endereço e a chave do seu Supabase |
| `supabase/schema.sql` | Cria a tabela e as regras de segurança |
| `.github/workflows/manter-ativo.yml` | A tarefa que mantém o Supabase ativo |

---

## Passo 1 — Criar o banco no Supabase (≈10 min)

1. Crie uma conta em **supabase.com** e clique em **New project**.
   - Nome: `metas` · Região: **South America (São Paulo)** · Guarde a senha do banco num lugar seguro.
2. Quando o projeto terminar de criar, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success".
3. Crie o seu usuário: **Authentication → Users → Add user → Create new user**.
   - Coloque seu e-mail e uma senha forte e marque **Auto Confirm User**.
4. Feche o cadastro para ninguém mais criar conta: em **Authentication → Sign In / Providers** (em algumas versões, **Authentication → Settings**), desligue **Allow new users to sign up** e salve.
5. Copie o endereço e a chave: em **Project Settings → API** (ou **API Keys**):
   - **Project URL** (ex.: `https://abcdefgh.supabase.co`)
   - A chave **anon public** ou **publishable** (começa com `eyJ...` ou `sb_publishable_...`)
   - ⚠️ **Nunca** use a chave `service_role` / `secret`.
6. Abra `config.js` num editor de texto e cole os dois valores no lugar de `COLE_AQUI_...`.

## Passo 2 — Publicar o site no GitHub Pages (≈10 min)

1. No **github.com**, crie um repositório novo (ex.: `metas`), **Public**, sem README.
2. Envie os arquivos. Pelo navegador: **Add file → Upload files** e arraste `index.html`, `config.js`, `README.md` e a pasta `supabase`.
   - A pasta `.github` costuma ficar escondida e não ser enviada arrastando. Crie esse arquivo à mão: **Add file → Create new file**, digite o nome `.github/workflows/manter-ativo.yml`, cole o conteúdo do arquivo e salve (Commit).
   - Se você usa Git: `git init`, `git add .`, `git commit -m "metas"`, `git remote add origin ...` e `git push -u origin main`.
3. Em **Settings → Pages**: Source **Deploy from a branch**, Branch **main** e pasta **/ (root)**, depois **Save**.
4. Em 1 ou 2 minutos o site fica no ar em `https://SEU-USUARIO.github.io/metas/`.

> Seu código fica público, mas os seus **dados não**: o banco só entrega metas para quem estiver logado como você. A chave que vai no `config.js` é feita para ficar pública.

## Passo 3 — Ligar a tarefa que mantém o Supabase ativo (≈3 min)

1. No repositório: **Settings → Secrets and variables → Actions → New repository secret**. Crie dois:
   - `SUPABASE_URL` = a Project URL
   - `SUPABASE_KEY` = a mesma chave anon/publishable
2. Na aba **Actions**, abra **Manter Supabase ativo → Run workflow** para testar. Ele deve ficar verde ✔.

## Passo 4 — Usar

1. Abra o site, entre com o e-mail e a senha do Passo 1.3.
2. Na primeira vez, toque em **Carregar minhas 10 metas iniciais**.
3. No celular, use **Adicionar à tela inicial** (Chrome: menu ⋮; iPhone/Safari: Compartilhar). Fica como um app.
4. O login fica salvo no aparelho; você só entra de novo se tocar em **Sair**.

## Backup

O plano grátis do Supabase não faz backup automático. Uma vez por mês, toque em **Baixar backup** (rodapé do painel) e guarde o arquivo `.json`. Para voltar um backup, use **Restaurar backup**: ele substitui as metas atuais pelas do arquivo.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| "Falta configurar" na tela de login | O `config.js` ainda tem `COLE_AQUI`, ou não foi enviado ao GitHub. |
| "E-mail ou senha incorretos" | Confira o usuário em Authentication → Users. Dá para redefinir a senha por lá. |
| "Não consegui carregar suas metas" | O projeto pode ter sido pausado: no painel do Supabase, abra o projeto e clique em **Resume project**. Confira também se o Passo 3 está verde. |
| Mudança não aparece no outro aparelho | O painel recarrega quando você volta para a aba. Se não aparecer, puxe para atualizar. |
