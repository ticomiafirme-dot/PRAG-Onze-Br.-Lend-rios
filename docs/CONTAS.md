# Contas, login com Google e nuvem

O PRAG Onze BR Lendário usa o **Supabase** como backend: o **Supabase Auth** faz o login com Google (OAuth 2.0 com PKCE) e o **Postgres** guarda perfis, progresso, temporadas, títulos e conquistas, protegidos por **Row Level Security** (cada usuário só lê e grava os próprios dados).

Sem as variáveis de ambiente do Supabase, o jogo funciona inteiro como **visitante**, com os dados salvos só no navegador. A página publicada no Claude roda sempre assim, porque o ambiente isolado dela não permite o login externo.

## O que fica salvo na conta

| Dado | Onde | Quando |
| --- | --- | --- |
| Perfil (nome, foto, e-mail, data de entrada, avatar de jogador escolhido como foto) | `profiles` | criado no primeiro login (gatilho no banco); o avatar, ao escolher em Meu Perfil |
| Partida em andamento (draft, clube, décadas, formação, jogadores, capitão, temporada, rodada, resultados, classificação, estatísticas) | `game_saves` (compactado) | automaticamente a cada mudança, ~1,5 s depois da última |
| Temporadas (registro permanente com escalação, tabela, jogos e estatísticas) | `seasons` | ao começar, terminar ou abandonar a temporada |
| Títulos | `titles` | assim que são conquistados |
| Conquistas | `user_achievements` | assim que são desbloqueadas |

Tudo é gravado primeiro no aparelho e enviado por uma fila que sobrevive a quedas de conexão e ao fechamento do navegador. O cabeçalho mostra o estado: **Salvando…**, **Sincronizado**, **Sem conexão · salvo no aparelho** ou **Erro de sincronização** (este último com toque para tentar de novo).

Se o mesmo jogador tiver partidas diferentes em andamento na nuvem e no aparelho, o jogo pergunta qual continuar. Temporadas finalizadas nunca se perdem: ficam no histórico de qualquer forma.

## Passo a passo

### 1. Projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com). A região São Paulo (`sa-east-1`) dá a menor latência no Brasil.
2. Em **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem: [`20261113000000_contas.sql`](../supabase/migrations/20261113000000_contas.sql) e depois [`20261114000000_avatar_perfil.sql`](../supabase/migrations/20261114000000_avatar_perfil.sql). Com a CLI, use `supabase link` e depois `supabase db push`.
3. Em **Project Settings → API**, copie:
   - **Project URL**: `https://<ref>.supabase.co`
   - **anon / publishable key**: chave pública, que vai no frontend.
   - A chave **service_role** não deve ir para o frontend nem para o repositório.

### 2. Credenciais OAuth no Google Cloud

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie (ou escolha) um projeto.
2. **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo **Externo**.
   - Nome do app, e-mail de suporte e logotipo.
   - Escopos padrão: `openid`, `email`, `profile`.
   - Publique o app (modo **Em produção**) para liberar qualquer conta Google, não só usuários de teste.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas**:
     - `https://seu-dominio.com.br`
     - `http://localhost:5173` (desenvolvimento)
     - `http://localhost:4173` (`vite preview`)
   - **URIs de redirecionamento autorizados**: `https://<ref>.supabase.co/auth/v1/callback`
4. Guarde o **Client ID** e o **Client secret**.

### 3. Google no Supabase Auth

1. Em **Authentication → Sign In / Providers → Google**, ative o provedor e cole o Client ID e o Client secret. O segredo fica guardado só no Supabase.
2. Em **Authentication → URL Configuration**:
   - **Site URL**: `https://seu-dominio.com.br/`
   - **Redirect URLs**:
     - `https://seu-dominio.com.br/**`
     - `http://localhost:5173/**`
     - `http://localhost:4173/**`

O jogo pede para o Google devolver o jogador ao mesmo endereço em que ele estava (origem + caminho, sem o `#`). Se publicar num subcaminho, como o GitHub Pages em `usuario.github.io/prag/`, inclua esse caminho nas URLs acima.

### 4. Variáveis de ambiente do build

Copie `.env.example` para `.env.local` (desenvolvimento) ou cadastre as variáveis no serviço de hospedagem:

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-ou-publishable-key>
```

Depois gere o site:

```bash
npm run build
```

O resultado em `dist/` é estático e serve em Vercel, Netlify, Cloudflare Pages, GitHub Pages ou qualquer servidor de arquivos. No Vercel e no Netlify, cadastre as duas variáveis no painel do projeto antes do build.

## Segurança e privacidade

- **Sem senhas**: o login é feito pelo Google; o jogo não vê nem guarda senhas. O Supabase guarda a sessão (JWT de curta duração com renovação automática) no navegador.
- **RLS em todas as tabelas**:
  - `profiles`: o próprio usuário lê, cria e edita.
  - `game_saves`: o próprio usuário lê, cria, atualiza e apaga.
  - `seasons`: lê e registra as próprias; só atualiza as que estão em andamento; não há exclusão.
  - `titles` e `user_achievements`: lê e registra; não há alteração nem exclusão.
  - O papel `anon` (sem login) não tem acesso a nenhuma tabela.
- **Registro permanente**: um gatilho impede alterar uma temporada finalizada ou abandonada, até pelo dono do banco. Conquistas e títulos não podem ser alterados nem apagados pela API e não se repetem (chave primária).
- **Revisão do progresso**: cada gravação incrementa `revision`. Um aparelho só sobrescreve o progresso se estiver na mesma revisão da nuvem; se não estiver, o jogo pergunta qual partida manter.
- **Limites**: o banco recusa progresso acima de 3 MB e registros de temporada acima de 400 KB.
- **Ao sair da conta**: o que falta é enviado. Se tudo foi sincronizado, o cache local da conta é apagado. Se não, ele fica guardado no aparelho e é enviado no próximo login dessa conta. O visitante seguinte nunca vê os dados da conta.
- **Sessão expirada**: o jogo avisa e continua salvando neste aparelho; tudo vai para a nuvem quando o jogador entra de novo.
- **Excluir uma conta**: apagar o usuário em **Authentication → Users** remove, em cascata, perfil, progresso, temporadas, títulos e conquistas.

> A simulação das partidas roda no navegador. Por isso, um jogador mal-intencionado consegue gravar números falsos **na própria conta**, mas nunca na de outra pessoa. Para um ranking competitivo oficial, a validação teria que ser feita no servidor.

## Testes

```bash
npm test                 # inclui as regras do banco (RLS, gatilhos) num Postgres embutido (PGlite)
npm run e2e:cloud        # login com Google, salvamento automático, dois aparelhos, saída e conflito (Supabase simulado)
```

Para o `e2e:cloud`, gere o build apontando para o endereço simulado e sirva-o na porta 4174:

```bash
VITE_SUPABASE_URL=https://prag-e2e.supabase.co VITE_SUPABASE_ANON_KEY=e2e-anon npx vite build --outDir dist-cloud
```

```bash
npx vite preview --outDir dist-cloud --port 4174
```

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `supabase/migrations/20261113000000_contas.sql` | tabelas, relacionamentos, gatilhos e políticas RLS |
| `supabase/migrations/20261114000000_avatar_perfil.sql` | foto de perfil (avatar de jogador) |
| `src/cloud/config.ts` | lê as variáveis de ambiente |
| `src/cloud/supabase.ts` | cliente Supabase (PKCE, sessão persistente) |
| `src/cloud/session.ts` | login, retorno do Google, sessão, expiração e saída |
| `src/cloud/repo.ts` | leitura e gravação de cada tabela |
| `src/cloud/sync.ts` | salvamento automático, fila persistente, revisões e conflitos |
| `src/history/*` | temporadas, títulos, conquistas e recordes (os mesmos para visitante e conta) |
