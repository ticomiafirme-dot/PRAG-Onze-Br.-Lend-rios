# Ligar o login no site do Netlify (passo a passo curto)

São três contas grátis: **Supabase** (guarda as contas e o progresso), **Google Cloud** (o botão "Entrar com Google") e o **Netlify** que você já usa. Troque `SEU-SITE` pelo endereço do seu jogo (ex.: `11brlendario`).

## 1. Supabase (5 minutos)

1. Em [supabase.com](https://supabase.com), clique em **New project**. Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro (o jogo não usa).
2. No menu da esquerda, **SQL Editor** → **New query**. Cole o arquivo [`supabase/instalar.sql`](../supabase/instalar.sql) inteiro e clique em **Run**. Deve aparecer "Success".
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://SEU-SITE.netlify.app/`
   - **Redirect URLs** → **Add URL**: `https://SEU-SITE.netlify.app/**`
4. **Project Settings → API** (ou **Data API / API Keys**): copie a **Project URL** e a chave **anon** (ou **publishable**). Não use a **service_role**/**secret**.

## 2. Google Cloud (10 minutos)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: "PRAG Onze BR").
2. **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform**): tipo **Externo**, nome do app "Onze BR Lendário PRAG", seu e-mail de suporte. Depois clique em **Publicar app** para qualquer pessoa conseguir entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas**: `https://SEU-SITE.netlify.app`
   - **URIs de redirecionamento autorizados**: `https://SEU-PROJETO.supabase.co/auth/v1/callback` (o endereço do Supabase do passo 1.4 + `/auth/v1/callback`)
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.
5. Volte ao Supabase: **Authentication → Sign In / Providers → Google** → ative, cole o ID e a chave secreta, **Save**. A chave secreta fica só no Supabase.

## 3. Netlify (1 minuto)

Escolha um dos dois:

- **Mais simples**: envie a **Project URL** e a chave **anon/publishable** do Supabase para o Claude, que as coloca no `netlify.toml`. O Netlify publica sozinho em seguida.
- **Ou você mesmo**: no Netlify, **Project configuration → Environment variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores e depois **Deploys → Trigger deploy → Deploy project**.

Pronto: o botão **Entrar com Google** aparece no cabeçalho, no menu, na tela inicial e no Meu Perfil.

## Se algo der errado

| Mensagem | Causa provável |
| --- | --- |
| `redirect_uri_mismatch` (tela do Google) | A URI de redirecionamento no Google Cloud não é exatamente `https://SEU-PROJETO.supabase.co/auth/v1/callback` |
| Volta ao jogo sem entrar, ou cai em `localhost` | Faltou o endereço do Netlify em **Site URL / Redirect URLs** do Supabase |
| `Unsupported provider: provider is not enabled` | O Google não foi ativado no Supabase (passo 2.5) |
| Só você consegue entrar | O app do Google ainda está em modo de teste: clique em **Publicar app** (passo 2.2) |
| O botão "Entrar" não aparece | As duas chaves não chegaram ao build: confira o passo 3 e faça um novo deploy |

Detalhes técnicos (tabelas, segurança, testes): [CONTAS.md](CONTAS.md).
