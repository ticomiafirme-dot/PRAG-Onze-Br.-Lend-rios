#!/usr/bin/env node
// Teste ponta a ponta das contas e da sincronização entre aparelhos.
// O Supabase é simulado aqui (login Google e banco em memória, com as mesmas
// regras de acesso: cada usuário só vê os próprios dados; temporada
// finalizada não muda; título exige temporada; conquista não duplica).
// As regras reais do banco são testadas em src/cloud/schema.test.ts.
//
// Uso:
//   VITE_SUPABASE_URL=https://prag-e2e.supabase.co VITE_SUPABASE_ANON_KEY=e2e-anon npx vite build --outDir dist-cloud
//   npx vite preview --outDir dist-cloud --port 4174 &
//   node scripts/e2e-cloud.mjs [url] [pasta-de-capturas]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4174/';
const OUT = process.argv[3] ?? 'test-results/e2e-cloud';
const SUPA = 'https://prag-e2e.supabase.co';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Supabase simulado
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (p) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(p)}.assinatura`;
const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

const PK = { profiles: ['id'], game_saves: ['user_id'], seasons: ['user_id', 'run_id'], titles: ['user_id', 'id'], user_achievements: ['user_id', 'achievement_id'] };
const OWNER = { profiles: 'id', game_saves: 'user_id', seasons: 'user_id', titles: 'user_id', user_achievements: 'user_id' };

class FakeSupabase {
  users = new Map();
  tables = { profiles: [], game_saves: [], seasons: [], titles: [], user_achievements: [] };
  account = null; // conta escolhida no seletor do Google
  log = [];

  session(u) {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: jwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, session_id: `s-${u.id}` }),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `r-${u.id}`,
      user: this.userJson(u),
    };
  }
  userJson(u) {
    return {
      id: u.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: u.email,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: u.name, avatar_url: u.avatar, email: u.email },
      identities: [],
      created_at: u.created,
      updated_at: u.created,
    };
  }
  /** Primeiro login: cria o usuário e o perfil (como o gatilho do banco). */
  signUp(u) {
    if (this.users.has(u.id)) return this.users.get(u.id);
    const user = { ...u, created: new Date().toISOString() };
    this.users.set(u.id, user);
    this.tables.profiles.push({ id: u.id, display_name: u.name, avatar_url: u.avatar, email: u.email, created_at: user.created, updated_at: user.created });
    return user;
  }

  handle = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status, body, headers = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: body === undefined ? '' : JSON.stringify(body) });
    if (method === 'OPTIONS')
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    this.log.push(`${method} ${url.pathname}${url.search}`);

    // ----- Auth
    if (url.pathname === '/auth/v1/authorize') {
      const redirect = url.searchParams.get('redirect_to');
      if (!this.account) return route.fulfill({ status: 302, headers: { location: `${redirect}?error=access_denied&error_description=Login+cancelado` } });
      const user = this.signUp(this.account);
      return route.fulfill({ status: 302, headers: { location: `${redirect}?code=code-${user.id}` } });
    }
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(req.postData() || '{}');
      const grant = url.searchParams.get('grant_type');
      const id = grant === 'pkce' ? String(body.auth_code).replace(/^code-/, '') : String(body.refresh_token).replace(/^r-/, '');
      const user = this.users.get(id);
      if (!user) return json(400, { error: 'invalid_grant', error_description: 'código inválido' });
      return json(200, this.session(user));
    }
    if (url.pathname === '/auth/v1/user') {
      const uid = this.uid(req);
      return uid ? json(200, this.userJson(this.users.get(uid))) : json(401, { message: 'JWT inválido' });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

    // ----- REST
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!m || !this.tables[m[1]]) return json(404, { message: `não simulado: ${url.pathname}` });
    const table = m[1];
    const uid = this.uid(req);
    if (!uid) return json(401, { code: '42501', message: 'permission denied' });
    const rows = this.tables[table];
    const own = (r) => r[OWNER[table]] === uid; // RLS
    const filters = [...url.searchParams].filter(([k]) => !['select', 'order', 'on_conflict', 'limit', 'columns'].includes(k));
    const matches = (r) => filters.every(([k, v]) => (v.startsWith('eq.') ? String(r[k]) === v.slice(3) : true));
    const prefer = req.headers()['prefer'] ?? '';
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const select = url.searchParams.get('select');
    const project = (r) => (!select || select === '*' ? r : Object.fromEntries(select.split(',').map((c) => [c, r[c]])));
    const respond = (status, list) => {
      if (!prefer.includes('return=representation') && method !== 'GET') return route.fulfill({ status, headers: { 'access-control-allow-origin': '*' }, body: '' });
      const out = list.map(project);
      if (wantsObject) return out.length === 1 ? json(status === 201 ? 201 : 200, out[0]) : json(406, { code: 'PGRST116', message: 'esperava 1 linha' });
      return json(status, out);
    };

    if (method === 'GET') {
      let list = rows.filter((r) => own(r) && matches(r));
      const order = url.searchParams.get('order');
      if (order) {
        const [col, dir] = order.split('.');
        list = [...list].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1));
      }
      return respond(200, list);
    }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '[]');
      const list = Array.isArray(body) ? body : [body];
      const ignore = prefer.includes('resolution=ignore-duplicates');
      const inserted = [];
      for (const r0 of list) {
        const r = { ...r0 };
        if (!own(r)) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
        const key = (x) => PK[table].map((c) => x[c]).join('|');
        if (rows.some((x) => key(x) === key(r))) {
          if (ignore) continue;
          return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        }
        if (table === 'titles' && !this.tables.seasons.some((s) => s.user_id === r.user_id && s.run_id === r.run_id))
          return json(409, { code: '23503', message: 'insert or update on table "titles" violates foreign key constraint' });
        const now = new Date().toISOString();
        if (table === 'game_saves') Object.assign(r, { revision: 1, updated_at: now, encoding: r.encoding ?? 'gzip-base64' });
        r.created_at ??= now;
        r.updated_at ??= now;
        rows.push(r);
        inserted.push(r);
      }
      return respond(201, inserted);
    }
    if (method === 'PATCH') {
      const patch = JSON.parse(req.postData() || '{}');
      const updated = [];
      for (const r of rows) {
        if (!own(r) || !matches(r)) continue;
        if (table === 'seasons' && r.status !== 'in_progress') continue; // política: só em andamento
        const keep = { user_id: r.user_id, run_id: r.run_id, started_at: r.started_at, created_at: r.created_at, revision: r.revision };
        Object.assign(r, patch, { updated_at: new Date().toISOString() });
        if (table === 'seasons') Object.assign(r, { user_id: keep.user_id, run_id: keep.run_id, started_at: keep.started_at, created_at: keep.created_at });
        if (table === 'game_saves') r.revision = keep.revision + 1;
        updated.push(r);
      }
      return respond(200, updated);
    }
    return json(405, { message: 'método não simulado' });
  };

  uid(req) {
    const auth = req.headers()['authorization'] ?? '';
    try {
      const p = decode(auth.replace(/^Bearer /, ''));
      return p.role === 'authenticated' ? p.sub : null;
    } catch {
      return null;
    }
  }

  saveOf(uid) {
    const s = this.tables.game_saves.find((x) => x.user_id === uid);
    if (!s?.payload) return null;
    return JSON.parse(zlib.gunzipSync(Buffer.from(s.payload, 'base64')).toString());
  }
}

// ---------------------------------------------------------------------------
const backend = new FakeSupabase();
const ACC = { id: '5b0c7b9e-3a1f-4c2e-9d8a-2f6e1c0b7a11', email: 'jogador.teste@exemplo.com', name: 'Jogador Teste', avatar: 'https://lh3.googleusercontent.com/a/teste' };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const errors = [];
const browser = await chromium.launch();

async function device(name, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(`${SUPA}/**`, backend.handle);
  await ctx.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG1 }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`${name} console: ${m.text()}`);
  });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${name}-${n}.png`) });
  const dismiss = async () => {
    for (let i = 0; i < 25; i++) {
      const o = page.locator('.unlock-overlay');
      if (!(await o.count())) return;
      await o.locator('button', { hasText: /^Continuar/ }).first().click();
      await page.waitForTimeout(150);
    }
  };
  const synced = async () => {
    await page.waitForFunction(() => document.querySelector('.sync-chip')?.classList.contains('is-synced'), null, { timeout: 15000 });
  };
  return { ctx, page, shot, dismiss, synced };
}

const step = (s) => console.log(`[nuvem] ${s}`);

// ---------- Aparelho A: computador
const A = await device('computador', { viewport: { width: 1280, height: 860 } });
await A.page.goto(BASE);
await A.page.waitForSelector('.home-account .btn-google');
step('visitante vê "Entrar com Google" e "Continuar como visitante"');
if (!(await A.page.getByRole('button', { name: /Continuar como visitante/i }).count())) errors.push('sem opção de visitante na página inicial');
await A.shot('01-inicio-visitante');

// login cancelado: volta com erro e continua como visitante
backend.account = null;
await A.page.locator('.home-account .btn-google').click();
await A.page.waitForURL(/inicio/);
await A.page.goto(BASE + '#perfil');
await A.page.waitForSelector('.login-gate');
step('login cancelado tratado');

// login de verdade
backend.account = ACC;
await A.page.locator('.login-gate .btn-google').click();
await A.page.waitForSelector('.header-user', { timeout: 15000 });
if (/code=/.test(A.page.url())) errors.push(`URL com o código do login: ${A.page.url()}`);
const headerName = await A.page.locator('.header-user-name').textContent();
if (headerName.trim() !== 'Jogador') errors.push(`nome no cabeçalho: ${headerName}`);
if (!backend.tables.profiles.some((p) => p.id === ACC.id)) errors.push('perfil não foi criado no primeiro login');
await A.synced();
step('login com Google concluído, perfil criado');
await A.page.goto(BASE + '#perfil');
await A.page.waitForSelector('.profile-card');
const perfil = await A.page.locator('.profile-card').textContent();
if (!perfil.includes('jogador.teste@exemplo.com') || !perfil.includes('Jogador Teste')) errors.push('perfil sem nome ou e-mail');
await A.shot('02-perfil');

// começa uma partida e faz 5 escolhas no draft
await A.page.goto(BASE + '#inicio');
await A.page.getByRole('button', { name: /Jogar agora/i }).click();
await A.page.locator('.club-tile', { hasText: 'Corinthians' }).click();
await A.page.getByRole('button', { name: /Sortear décadas/i }).click();
await A.page.locator('.formation-card', { hasText: '4-3-3' }).click();
await A.page.getByRole('button', { name: /Iniciar draft/i }).click();
for (let r = 0; r < 5; r++) {
  await A.page.waitForSelector('.roulette.is-done', { timeout: 8000 });
  await A.page.locator('.offers button.pcard').first().click();
  await A.page.waitForTimeout(150);
}
await A.page.waitForTimeout(400);
await A.synced();
const save = backend.saveOf(ACC.id);
const picks = Object.keys(save?.run?.draft?.picks ?? {}).length;
if (picks !== 5) errors.push(`progresso salvo na nuvem com ${picks} escolhas (esperava 5)`);
step(`progresso salvo automaticamente (${picks} escolhas, revisão ${backend.tables.game_saves[0]?.revision})`);
await A.shot('03-draft-salvo');

// ---------- Aparelho B: celular, mesma conta
const B = await device('celular', { ...devices['iPhone 13'] });
await B.page.goto(BASE);
await B.page.locator('.header-login .btn-google, .home-account .btn-google').first().click();
await B.page.waitForSelector('.header-user', { timeout: 15000 });
await B.synced();
await B.page.goto(BASE + '#inicio');
await B.page.waitForSelector('.resume-card');
step('celular encontra a partida em andamento');
await B.page.getByRole('button', { name: /^Continuar$/ }).click();
await B.page.waitForURL(/#draft/);
await B.page.waitForSelector('.draft-pitch .pitch-slot .pcard', { timeout: 8000 }).catch(() => undefined);
const filled = await B.page.locator('.draft-pitch .pitch-slot .pcard').count();
if (filled !== 5) errors.push(`celular mostra ${filled} jogadores escolhidos (esperava 5)`);
await B.shot('04-celular-continua');
// termina o draft e a temporada no celular
for (let r = 0; r < 6; r++) {
  await B.page.waitForSelector('.roulette.is-done', { timeout: 8000 });
  await B.page.locator('.offers button.pcard').first().click();
  await B.page.waitForTimeout(150);
}
await B.page.waitForURL(/#escalacao/, { timeout: 8000 });
await B.dismiss();
await B.page.getByRole('button', { name: /Escolher capitão/i }).click();
await B.page.locator('.captain-grid button.pcard').first().click();
await B.page.getByRole('button', { name: /pré-temporada/i }).click();
await B.page.getByRole('button', { name: /Iniciar temporada/i }).click();
await B.page.waitForURL(/#campeonato/);
await B.dismiss();
await B.page.getByRole('button', { name: /Simular até o fim/i }).click();
await B.page.getByRole('dialog').getByRole('button', { name: /^Simular$/ }).click();
await B.page.waitForURL(/#resultado/);
await B.page.waitForTimeout(600);
await B.shot('05-celular-conquista');
await B.dismiss();
await B.synced();
const runId = save.run.id;
const seasonRow = backend.tables.seasons.find((s) => s.run_id === runId);
if (seasonRow?.status !== 'finished' || !seasonRow.details) errors.push(`temporada na nuvem: ${seasonRow?.status} (detalhes: ${!!seasonRow?.details})`);
if (!backend.tables.user_achievements.some((a) => a.achievement_id === 'estreia')) errors.push('conquista Estreia não chegou à nuvem');
if (seasonRow?.champion && !backend.tables.titles.some((t) => t.run_id === runId && t.competition_id === 'brasileirao')) errors.push('título do Brasileirão não chegou à nuvem');
step(`temporada finalizada salva na nuvem (${seasonRow?.points} pts, ${backend.tables.user_achievements.length} conquistas, ${backend.tables.titles.length} títulos)`);

// ---------- Volta ao computador: histórico sincronizado
await A.page.reload();
await A.page.waitForSelector('.header-user', { timeout: 15000 });
await A.synced();
await A.page.goto(BASE + '#historico');
await A.page.waitForSelector('.season-card');
await A.page.locator('.season-card', { hasText: 'Corinthians' }).first().click();
await A.page.waitForSelector('table.data tbody tr', { timeout: 15000 });
const rows = await A.page.locator('table.data').first().locator('tbody tr').count();
if (rows !== 20) errors.push(`computador: classificação com ${rows} linhas`);
step('computador vê a temporada jogada no celular, com detalhes da nuvem');
await A.page.goto(BASE + '#hall');
await A.page.waitForSelector('.hall-title');
const owner = (await A.page.locator('.hall-owner strong').textContent()).trim();
if (owner !== 'Jogador Teste') errors.push(`Hall sem o nome do jogador: ${owner}`);
await A.shot('06-hall-sincronizado');
await A.page.goto(BASE + '#conquistas');
await A.page.waitForSelector('.ach-card.is-unlocked');

// ---------- Foto de perfil com avatar de jogador, sincronizada entre aparelhos
await A.page.goto(BASE + '#perfil');
await A.page.getByRole('button', { name: 'Trocar foto' }).click();
await A.page.getByLabel('Buscar jogador pelo nome').fill('zico');
await A.page.getByLabel('Filtrar por clube').selectOption('flamengo');
await A.page.getByLabel('Filtrar por década').selectOption('1980s');
await A.page.locator('.avatar-picker .picker-item').first().click();
await A.page.getByRole('button', { name: 'Usar este avatar' }).click();
await A.page.waitForSelector('.avatar-picker', { state: 'detached' });
const profileRow = backend.tables.profiles.find((p) => p.id === ACC.id);
if (profileRow?.game_avatar !== 'zico@flamengo@1980s') errors.push(`foto de perfil não gravada na nuvem: ${profileRow?.game_avatar}`);
await B.page.reload();
await B.page.waitForSelector(".header-user .pavatar", { timeout: 15000 });
const phoneAlt = await B.page.locator('.header-user .pavatar').getAttribute('alt');
if (phoneAlt !== 'Zico') errors.push(`foto de perfil não chegou ao celular: ${phoneAlt}`);
step('foto de perfil (avatar do Zico no Flamengo) salva na conta e vista no celular');

// ---------- Sair da conta
await A.page.locator('.menu-button').click();
await A.page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: /Sair da conta/i }).click();
await A.page.waitForSelector('.header-login .btn-google', { timeout: 15000 });
await A.page.goto(BASE + '#historico');
await A.page.waitForSelector('.history-page');
if (await A.page.locator('.season-card').count()) errors.push('após sair, o histórico da conta continua visível');
step('saiu da conta: dados da conta não aparecem para o visitante');

// o celular começa outra partida (fica em andamento na nuvem)
await B.page.goto(BASE + '#inicio');
await B.page.getByRole('button', { name: /Novo jogo|Jogar agora/i }).first().click();
const dlgB = B.page.getByRole('dialog');
if (await dlgB.count()) await dlgB.getByRole('button').last().click();
await B.page.locator('.club-tile', { hasText: 'Santos' }).click();
await B.page.getByRole('button', { name: /Sortear décadas/i }).click();
await B.page.locator('.formation-card', { hasText: '4-3-3' }).click();
await B.page.getByRole('button', { name: /Iniciar draft/i }).click();
for (let r = 0; r < 2; r++) {
  await B.page.waitForSelector('.roulette.is-done', { timeout: 8000 });
  await B.page.locator('.offers button.pcard').first().click();
  await B.page.waitForTimeout(150);
}
await B.page.waitForTimeout(300);
await B.synced();
if (backend.saveOf(ACC.id)?.run?.clubId !== 'santos') errors.push('nova partida do celular não chegou à nuvem');

// visitante começa outra partida no computador e entra de novo: escolha entre aparelho e nuvem
await A.page.goto(BASE + '#inicio');
await A.page.getByRole('button', { name: /Jogar agora/i }).click();
await A.page.locator('.club-tile', { hasText: 'Flamengo' }).click();
await A.page.getByRole('button', { name: /Sortear décadas/i }).click();
await A.page.locator('.formation-card', { hasText: '4-4-2' }).click();
await A.page.getByRole('button', { name: /Iniciar draft/i }).click();
await A.page.waitForSelector('.roulette.is-done', { timeout: 8000 });
await A.page.locator('.offers button.pcard').first().click();
await A.page.waitForTimeout(200);
await A.page.locator('.header-login .btn-google').click();
await A.page.waitForSelector('.conflict-option', { timeout: 15000 });
const conflictText = await A.page.locator('.conflict-options').textContent();
if (!/Santos · draft 2\/11/.test(conflictText) || !/Flamengo · draft 1\/11/.test(conflictText)) errors.push(`resumo do conflito: ${conflictText}`);
await A.shot('07-conflito');
await A.page.locator('.conflict-option', { hasText: 'Neste aparelho' }).click();
await A.synced();
const after = backend.saveOf(ACC.id);
if (after?.run?.clubId !== 'flamengo') errors.push(`após escolher "neste aparelho", a nuvem guarda ${after?.run?.clubId}`);
await A.page.goto(BASE + '#historico');
await A.page.waitForSelector('.season-card');
step('entrou de novo: histórico de volta e conflito resolvido pela escolha do jogador');

console.log(`requisições ao Supabase simulado: ${backend.log.length}`);

await browser.close();
if (errors.length) {
  console.error('ERROS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('E2E NUVEM OK — capturas em', OUT);
