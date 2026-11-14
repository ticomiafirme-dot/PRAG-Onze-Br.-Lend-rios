# Publicar no Cloudflare Pages (grátis, sem limite de publicações por crédito)

O jogo é um site estático (Vite). No Cloudflare Pages ele é publicado direto
do GitHub: cada `git push` no branch escolhido gera uma versão nova em cerca
de 2 minutos. O plano grátis não cobra por publicação nem por tráfego.

O repositório já vem pronto:

- `.env.production`: endereço do Supabase e chave **pública** do login. O
  build de produção já sai com o "Entrar com Google", sem variáveis no painel.
- `.nvmrc`: Node 22 (o Vite 7 exige 20.19 ou mais novo).
- `public/_headers`: cache longo para `/assets/*` e cabeçalhos de segurança.
- Sem `404.html`: endereços desconhecidos abrem o jogo (as telas usam `#`).

## 1. Criar o projeto (uns 5 minutos)

1. Entre em <https://dash.cloudflare.com> (crie a conta grátis, se não tiver).
2. No menu da esquerda, **Workers & Pages** → **Create application**.
3. Escolha a aba/opção **Pages** (se aparecer só "Workers", clique em
   **"Looking to deploy Pages? Get started"**) → **Import an existing Git
   repository** (ou **Connect to Git**).
4. **GitHub** → autorize o Cloudflare e escolha o repositório
   **`ticomiafirme-dot/PRAG-Onze-Br.-Lend-rios`** → **Begin setup**.
5. Preencha:

   | Campo | Valor |
   | --- | --- |
   | Project name | `onzebrlendario` (vira `onzebrlendario.pages.dev`) |
   | Production branch | `claude/eager-planck-3iyvab` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   Não precisa criar variáveis de ambiente.
6. **Save and Deploy**. Em cerca de 2 minutos aparece **Success** e o link
   `https://onzebrlendario.pages.dev` (se o nome já estiver em uso, o
   Cloudflare mostra outro endereço: use esse nos passos seguintes).

## 2. Liberar o login no endereço novo (Supabase, 30 segundos)

No Supabase: **Authentication → URL Configuration**.

- **Site URL**: `https://onzebrlendario.pages.dev/`
- **Redirect URLs** → **Add URL**: `https://onzebrlendario.pages.dev/**`
  (deixe também o endereço antigo do Netlify na lista).
- **Save**.

No Google Cloud não é preciso mudar nada: o Google devolve o login para o
Supabase, não para o site. Se quiser, em **APIs e serviços → Credenciais →
seu cliente OAuth → Origens JavaScript autorizadas**, acrescente
`https://onzebrlendario.pages.dev`, e na **Tela de consentimento OAuth**
troque os links da página inicial e da política de privacidade para o
endereço novo (`https://onzebrlendario.pages.dev/privacidade.html`).

## 3. Conferir

1. Abra `https://onzebrlendario.pages.dev`.
2. Clique em **Entrar com Google**: deve voltar ao jogo já conectado, com o
   seu nick, conquistas e histórico.
3. Ranking → Campanhas/Conquistas mostra os mesmos dados de todos (o banco é
   o mesmo do site antigo: nada se perde na mudança).

## Endereço antigo (Netlify)

Enquanto os créditos do Netlify estiverem esgotados, o endereço antigo fica
na última versão publicada. Quando o endereço novo estiver funcionando, dá
para fazer o antigo mandar os jogadores para o novo (um redirecionamento no
`netlify.toml`, publicado quando o Netlify renovar os créditos).

## Problemas comuns

| Sintoma | Solução |
| --- | --- |
| Build falha com erro de versão do Node | Em **Settings → Variables and Secrets**, crie `NODE_VERSION` = `22` e publique de novo |
| O jogo abre, mas sem o botão "Entrar" | O build não leu o `.env.production`: confira se o **Build command** é `npm run build` (não `build:visitante`) |
| Login volta para o Netlify ou dá erro de redirecionamento | Faltou o passo 2 (Site URL / Redirect URLs no Supabase) |
| Versão nova não aparece | Veja **Deployments** no Cloudflare; depois de "Success", recarregue a página (Ctrl+Shift+R) |
