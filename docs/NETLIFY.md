# Publicar no Netlify

O jogo é um site estático: o build gera a pasta `dist/` (HTML, JS, CSS, fontes e imagens), sem servidor próprio. O arquivo [`netlify.toml`](../netlify.toml) já traz tudo o que o Netlify precisa:

| Configuração | Valor |
| --- | --- |
| Comando de build | `npm run build` |
| Pasta publicada | `dist` |
| Versão do Node | 22 (o Vite 7 exige 20.19 ou mais novo) |
| Cache | arquivos de `/assets/` em cache longo (o nome muda a cada versão) |

As rotas do jogo usam `#` (`/#clubes`, `/#perfil`...), então não é preciso configurar redirecionamentos.

## 1. Criar o site

1. Entre em [app.netlify.com](https://app.netlify.com) com a sua conta do GitHub.
2. **Add new project** (em contas antigas, *Add new site*) → **Import an existing project** → **GitHub**.
3. Autorize o Netlify a ler o repositório do jogo e escolha-o.
4. Em **Branch to deploy**, escolha o branch com a versão que você quer no ar.
5. Os campos de build vêm preenchidos pelo `netlify.toml`. Clique em **Deploy**.

Em cerca de um minuto o jogo fica no ar em um endereço como `https://nome-do-site.netlify.app`. O nome pode ser trocado em **Project configuration → Change project name**. A partir daí, cada `git push` nesse branch publica uma versão nova automaticamente.

Sem as variáveis do Supabase, o jogo funciona inteiro **como visitante**: progresso, histórico, conquistas, foto de perfil e ranking ficam salvos no navegador de cada jogador.

## 2. Ligar o login com Google (opcional)

1. Siga o [CONTAS.md](CONTAS.md) para criar o projeto no Supabase, rodar as migrações e configurar o Google.
2. No Netlify, em **Project configuration → Environment variables**, crie:
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a chave pública (*anon* / *publishable*) do Supabase

   Nunca coloque a chave `service_role` no Netlify nem no repositório.
3. No Supabase, em **Authentication → URL Configuration**:
   - **Site URL**: `https://nome-do-site.netlify.app/`
   - **Redirect URLs**: `https://nome-do-site.netlify.app/**` (e o seu domínio próprio, se houver)
   - Opcional, para as prévias de deploy: `https://**--nome-do-site.netlify.app/**`
4. No Netlify, em **Deploys → Trigger deploy → Deploy project**, publique de novo. As variáveis `VITE_*` entram no jogo durante o build, por isso o deploy precisa ser refeito depois de criá-las.

O botão **Entrar com Google** aparece no cabeçalho, no menu e na tela inicial assim que o site publicado tiver essas variáveis.

## 3. Domínio próprio (opcional)

Em **Domain management → Add a domain**, informe o domínio (por exemplo, um `.com.br` registrado no Registro.br) e siga as instruções de DNS. O Netlify emite o certificado HTTPS sozinho. Depois, inclua o novo endereço nas **Redirect URLs** do Supabase (passo 2.3).

## O que muda fora do Claude

- **Ranking**: na página publicada no Claude existe a aba "Todos os jogadores", que usa o armazenamento compartilhado do próprio Claude. Em uma hospedagem comum, como o Netlify, o ranking mostra só as campanhas salvas no aparelho do jogador. Um ranking global precisaria de uma tabela pública no Supabase.
- **Baixar arte**: no Claude, o download pede confirmação ao visitante; no Netlify, é um download comum do navegador.

Todo o resto (draft, temporadas, histórico, conquistas, recordes, Hall dos Lendários, avatares, artes de compartilhamento e contas com Google) funciona igual.

## Testar o build como o Netlify faz

```bash
npm ci
```

```bash
npm run build
```

```bash
npx vite preview
```
