#!/usr/bin/env node
// Teste ponta a ponta do fluxo completo (desktop e celular) com Playwright.
// Uso: npm run build && npx vite preview --port 4173 & node scripts/e2e.mjs [url] [pasta-de-capturas]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'test-results/e2e';
fs.mkdirSync(OUT, { recursive: true });

async function run(label, contextOpts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...contextOpts, acceptDownloads: true });
  if (label === 'desktop') await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  if (label === 'mobile') {
    // compartilhamento nativo simulado (como no celular)
    await ctx.addInitScript(() => {
      navigator.canShare = (d) => !!d?.files?.length;
      navigator.share = async (d) => {
        window.__shared = d.files[0].name + ':' + d.files[0].type + ':' + d.files[0].size;
      };
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  const CATS = ['GOL', 'DEF', 'MEI', 'ATA'];
  // só as 4 categorias aparecem nas cartas, abas e vagas
  const checkCategories = async (where) => {
    const texts = [
      ...(await page.locator('.pcard-pos').allTextContents()),
      ...(await page.locator('.slot-empty').allTextContents()),
      ...(await page.locator('.offers-panel [role=tab]').allTextContents()).map((t) => t.trim().split(/\s+/)[0]).filter((t) => t !== 'TODOS'),
    ];
    const bad = texts.map((t) => t.trim()).filter((t) => !CATS.includes(t));
    if (bad.length) errors.push(`${where}: posições fora das 4 categorias: ${[...new Set(bad)].join(', ')}`);
  };
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: false });
  const step = (s) => console.log(`[${label}] ${s}`);
  // comemorações de conquista/recorde/título aparecem por cima das telas
  let celebrated = 0;
  const dismiss = async () => {
    for (let i = 0; i < 25; i++) {
      const o = page.locator('.unlock-overlay');
      if (!(await o.count())) return;
      celebrated++;
      await o.locator('button', { hasText: /^Continuar/ }).first().click();
      await page.waitForTimeout(150);
    }
  };

  await page.goto(BASE);
  await page.getByRole('button', { name: /Jogar agora/i }).click();
  step('home -> clubes');
  await page.waitForURL(/#clubes/);
  await shot('02-clubes');
  await page.locator('.club-tile', { hasText: 'Corinthians' }).click();
  await page.waitForURL(/#clube-corinthians/);
  await shot('03-clube');
  step('clube -> formação');
  await page.getByRole('button', { name: /Sortear décadas/i }).click();
  await page.waitForURL(/#formacao/);
  const f424 = page.locator('.formation-card', { hasText: '4-2-4' });
  if (!(await f424.waitFor({ timeout: 8000 }).then(() => true, () => false))) errors.push('formação 4-2-4 não aparece na escolha de formação');
  else if (!/1\s*GOL[\s\S]*4\s*DEF[\s\S]*2\s*MEI[\s\S]*4\s*ATA/.test(await f424.textContent())) errors.push(`4-2-4 com distribuição errada: ${await f424.textContent()}`);
  await page.locator('.formation-card', { hasText: '4-3-3' }).click();
  await shot('04-formacao');
  await page.getByRole('button', { name: /Iniciar draft/i }).click();
  await page.waitForURL(/#draft/);
  step('draft');
  let used = 0;
  for (let round = 0; round < 11; round++) {
    await page.waitForSelector('.roulette.is-done', { timeout: 8000 });
    if (round === 0) await shot('05-draft');
    // usa um novo sorteio na 2ª rodada para testar o recurso
    if (round === 1 && used === 0) {
      await page.getByRole('button', { name: /Sortear novamente/i }).click();
      used++;
      await page.waitForSelector('.roulette.is-spinning');
      await page.waitForSelector('.roulette.is-done', { timeout: 8000 });
    }
    // na 4ª rodada, toca na última vaga dourada do campo: o jogador deve entrar nela
    let target = null;
    if (round === 3) {
      const gold = page.locator('.slot-empty.has-offer');
      const n = await gold.count();
      if (n > 1) {
        target = gold.nth(n - 1);
        const cat = (await target.textContent()).trim();
        const index = await target.evaluate((el) => [...document.querySelectorAll('.draft-pitch .pitch-slot')].indexOf(el.closest('.pitch-slot')));
        await target.click();
        const head = await page.locator('.offers-panel h2').textContent();
        if (!head.includes(`(${cat})`)) errors.push(`vaga ${cat} tocada, mas o painel mostra "${head}"`);
        target = { cat, index };
      }
    }
    const card = page.locator('.offers button.pcard').first();
    await card.waitFor({ timeout: 8000 });
    await checkCategories(`draft r${round + 1}`);
    if (round === 0) {
      // aba "Todos" aberta por padrão, com os overalls em ordem decrescente
      const sel = await page.locator('.offers-panel [role=tab][aria-selected=true]').textContent();
      if (!/^TODOS/.test(sel.trim())) errors.push(`aba padrão do draft deveria ser TODOS, veio "${sel}"`);
      const ovrs = (await page.locator('.offers .pcard-ovr-num').allTextContents()).map(Number);
      if (ovrs.some((v, i) => i > 0 && v > ovrs[i - 1])) errors.push(`aba TODOS fora de ordem: ${ovrs.join(',')}`);
    }
    // avatares ilustrados em todas as cartas, carregados (sem imagem quebrada)
    const faces = await page.$$eval('.offers .pcard .pavatar', (imgs) => imgs.map((i) => ({ ok: i.complete && i.naturalWidth > 0, svg: (i.getAttribute('src') ?? '').startsWith('data:image/svg+xml') })));
    if (!faces.length || faces.some((f) => !f.ok || !f.svg)) errors.push(`avatares das cartas do draft: ${JSON.stringify(faces.slice(0, 3))}`);
    await card.click();
    await page.waitForTimeout(150);
    if (target) {
      // a vaga tocada agora tem um jogador
      const filled = await page.locator('.draft-pitch .pitch-slot').nth(target.index).locator('.pcard').count();
      if (!filled) errors.push(`o jogador não entrou na vaga ${target.cat} tocada`);
    }
  }
  await page.waitForSelector('.draft-done', { timeout: 8000 });
  await shot('06-draft-completo');
  await page.waitForURL(/#escalacao/, { timeout: 8000 });
  await dismiss();
  step('escalação');
  await page.waitForTimeout(400);
  await shot('07-escalacao');
  await checkCategories('escalação');
  // troca entre dois defensores (ex.: zagueiro ↔ lateral) deve ser aceita
  const defs = page.locator('[aria-label$=", Defensor"]');
  if ((await defs.count()) >= 2) {
    await defs.nth(0).click();
    await defs.nth(1).click();
    const toast = await page.locator('.toast').last().textContent({ timeout: 3000 }).catch(() => '');
    if (!/trocaram de posição/.test(toast)) errors.push(`troca entre defensores recusada: "${toast}"`);
  } else errors.push('escalação sem dois defensores');
  await page.getByRole('button', { name: /Escolher capitão/i }).click();
  await page.waitForURL(/#capitao/);
  await page.locator('.captain-grid button.pcard').nth(10).click();
  await shot('08-capitao');
  await page.getByRole('button', { name: /pré-temporada/i }).click();
  await page.waitForURL(/#pre-temporada/);
  step('pré-temporada');
  await shot('09-pretemporada');
  await page.getByRole('button', { name: /Iniciar temporada/i }).click();
  await page.waitForURL(/#campeonato/);
  await dismiss();
  await shot('10-campeonato');
  step('partida');
  await page.getByRole('button', { name: /Jogar partida/i }).click();
  await page.waitForURL(/#partida/);
  await page.getByRole('button', { name: '4x' }).click();
  await page.waitForTimeout(3500);
  await shot('11-partida-ao-vivo');
  await page.getByRole('tab', { name: 'Estatísticas' }).click();
  await shot('12-partida-estatisticas');
  await page.getByRole('button', { name: /Pular para o final/i }).click();
  await page.waitForSelector('.fulltime');
  await page.waitForTimeout(2200);
  await shot('13-partida-fim');
  // empate no agregado: a disputa de pênaltis é animada; pula para o fim
  if (await page.locator('.pk-skip').count()) await page.locator('.pk-skip').click();
  // empate no agregado: a disputa de pênaltis é animada; pula para o fim
  if (await page.locator('.pk-skip').count()) await page.locator('.pk-skip').click();
  await page.getByRole('button', { name: /Continuar →/i }).click();
  await page.waitForURL(/#campeonato/);
  await dismiss();
  // simula um jogo rápido e depois o restante
  await page.getByRole('button', { name: /Simular resultado/i }).click();
  await page.waitForTimeout(300);
  await dismiss();
  await page.getByRole('button', { name: /Simular até o fim/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Simular$/ }).click();
  await page.waitForURL(/#resultado/);
  step('resultado');
  await page.waitForTimeout(800);
  if (!(await page.locator('.unlock-overlay').count())) errors.push('nenhuma conquista comemorada ao fim da primeira temporada (Estreia)');
  await shot('14a-conquista');
  await dismiss();
  await shot('14-resultado');

  // arte do resultado: prévia PNG + baixar / copiar / compartilhar
  step('arte do resultado');
  await page.getByRole('button', { name: /Compartilhar resultado/i }).click();
  await page.waitForSelector('.share-preview img', { timeout: 15000 });
  const dims = await page.evaluate(async () => {
    const img = document.querySelector('.share-preview img');
    const blob = await (await fetch(img.src)).blob();
    return { w: img.naturalWidth, h: img.naturalHeight, type: blob.type, size: blob.size };
  });
  if (dims.w !== 1080 || dims.h !== 1350 || dims.type !== 'image/png' || dims.size < 50_000) errors.push(`arte com formato inesperado: ${JSON.stringify(dims)}`);
  await shot('15a-arte');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: /Baixar arte/i }).click()]);
  const fname = download.suggestedFilename();
  if (!/^PRAG-Corinthians-.+-Resultado\.png$/.test(fname)) errors.push(`nome do arquivo inesperado: ${fname}`);
  const saved = path.join(OUT, `${label}-${fname}`);
  await download.saveAs(saved);
  if (fs.statSync(saved).size < 50_000) errors.push('PNG baixado muito pequeno');
  if (label === 'desktop') {
    await page.getByRole('button', { name: /Copiar imagem/i }).click();
    await page.waitForFunction(() => /copiada|não permite/i.test(document.querySelector('.share-status')?.textContent ?? ''), null, { timeout: 8000 });
    const st = await page.locator('.share-status').textContent();
    if (!/copiada/i.test(st)) errors.push(`copiar imagem: "${st}"`);
    const types = await page.evaluate(async () => (await navigator.clipboard.read())[0]?.types ?? []);
    if (!types.includes('image/png')) errors.push(`área de transferência sem PNG: ${types}`);
    await page.getByRole('button', { name: /Compartilhar imagem/i }).click();
    await page.waitForFunction(() => /diretamente/i.test(document.querySelector('.share-status')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => undefined);
    const st2 = await page.locator('.share-status').textContent();
    if (!/não compartilha imagens diretamente/i.test(st2)) errors.push(`fallback do compartilhar: "${st2}"`);
  } else {
    await page.getByRole('button', { name: /Compartilhar imagem/i }).click();
    await page.waitForTimeout(300);
    const shared = await page.evaluate(() => window.__shared);
    if (!shared || !/^PRAG-.+-Resultado\.png:image\/png:\d{5,}$/.test(shared)) errors.push(`compartilhamento nativo não recebeu o PNG: ${shared}`);
  }

  // arte da escalação: aba na mesma janela
  step('arte da escalação');
  await page.getByRole('tab', { name: 'Escalação' }).click();
  await page.waitForFunction(() => /escala/i.test(document.querySelector('.share-preview img')?.getAttribute('alt') ?? ''), null, { timeout: 20000 });
  const ldims = await page.evaluate(async () => {
    const img = document.querySelector('.share-preview img');
    const blob = await (await fetch(img.src)).blob();
    return { w: img.naturalWidth, h: img.naturalHeight, type: blob.type, size: blob.size };
  });
  if (ldims.w !== 1080 || ldims.h !== 1350 || ldims.type !== 'image/png' || ldims.size < 80_000) errors.push(`arte da escalação com formato inesperado: ${JSON.stringify(ldims)}`);
  await shot('15d-escalacao');
  const [ldl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: /Baixar arte/i }).click()]);
  const lname = ldl.suggestedFilename();
  if (!/^PRAG-Corinthians-.+-Escalacao\.png$/.test(lname)) errors.push(`nome do arquivo da escalação: ${lname}`);
  await ldl.saveAs(path.join(OUT, `${label}-${lname}`));
  if (label !== 'desktop') {
    await page.getByRole('button', { name: /Compartilhar imagem/i }).click();
    await page.waitForTimeout(300);
    const shared2 = await page.evaluate(() => window.__shared);
    if (!shared2 || !/^PRAG-.+-Escalacao\.png:image\/png:\d{5,}$/.test(shared2)) errors.push(`compartilhamento nativo da escalação: ${shared2}`);
  }
  await page.keyboard.press('Escape');

  // histórico, detalhe da temporada, conquistas, recordes e Hall
  step('histórico e Hall');
  await page.goto(BASE + '#historico');
  await page.waitForSelector('.season-card');
  if ((await page.locator('.season-card').count()) < 1) errors.push('histórico vazio após a temporada');
  await page.locator('.season-card').first().click();
  await page.waitForURL(/#temporada-/);
  await page.waitForSelector('table.data tbody tr');
  const rowsT = await page.locator('table.data').first().locator('tbody tr').count();
  if (rowsT !== 20) errors.push(`classificação da temporada com ${rowsT} linhas`);
  await shot('15b-temporada');
  await page.goto(BASE + '#conquistas');
  await page.waitForSelector('.ach-card');
  if (!(await page.locator('.ach-card.is-unlocked', { hasText: 'Estreia' }).count())) errors.push('conquista Estreia não aparece desbloqueada');
  if ((await page.locator('.ach-card').count()) < 6) errors.push('catálogo de conquistas incompleto');
  await page.goto(BASE + '#recordes');
  await page.waitForSelector('.record-card');
  const pts = await page.locator('.record-card', { hasText: 'Mais pontos' }).locator('.record-value').textContent();
  if (!/\d+ pontos/.test(pts)) errors.push(`recorde de pontos vazio: ${pts}`);
  await page.goto(BASE + '#hall');
  await page.waitForSelector('.hall-title');
  await shot('15c-hall');

  step('foto de perfil');
  await page.goto(BASE + '#perfil');
  await page.getByRole('button', { name: 'Trocar foto' }).click();
  await page.waitForSelector('.avatar-picker .picker-item');
  const total = await page.locator('.picker-count').textContent();
  await page.getByLabel('Buscar jogador pelo nome').fill('socrates');
  await page.getByLabel('Filtrar por clube').selectOption('flamengo');
  await page.waitForFunction(() => document.querySelectorAll('.avatar-picker .picker-item').length === 1);
  const only = await page.locator('.avatar-picker .picker-item').first().textContent();
  if (!/Sócrates/.test(only) || !/FLA/.test(only)) errors.push(`filtro nome + clube: "${only}" (total antes: ${total})`);
  await page.getByLabel('Filtrar por clube').selectOption('');
  await page.getByLabel('Filtrar por década').selectOption('1980s');
  const decadeItems = await page.locator('.avatar-picker .picker-item .picker-meta').allTextContents();
  if (!decadeItems.length || decadeItems.some((t) => !t.trim().endsWith('80'))) errors.push(`filtro por década: ${decadeItems.join(' | ')}`);
  await page.locator('.avatar-picker .picker-item', { hasText: 'COR' }).first().click();
  await shot('17-foto-de-perfil');
  await page.getByRole('button', { name: 'Usar este avatar' }).click();
  await page.waitForSelector('.avatar-picker', { state: 'detached' });
  const photo = await page.locator('.profile-photo .pavatar').getAttribute('src');
  if (!photo?.startsWith('data:image/svg+xml')) errors.push('foto de perfil não mostra o avatar escolhido');
  await page.reload();
  await page.waitForSelector('.profile-photo .pavatar');
  const kept = await page.locator('.profile-photo .pavatar').getAttribute('alt');
  if (!/Sócrates/.test(kept ?? '')) errors.push(`foto de perfil não persistiu: ${kept}`);
  if (label === 'desktop' && !(await page.locator('.header .header-user .pavatar').count())) errors.push('foto de perfil não aparece no cabeçalho');
  await page.reload();
  await page.goto(BASE + '#historico');
  await page.waitForSelector('.season-card');
  await page.goto(BASE + '#estatisticas');
  await page.waitForSelector('.kpi-grid');
  await shot('15-estatisticas');
  await page.goto(BASE + '#ranking');
  await page.waitForSelector('table.data');
  await shot('16-ranking');
  await page.goto(BASE + '#inicio');
  await page.waitForSelector('.hero');
  await shot('01-home');

  // Persistência: recarrega e verifica que o ranking continua lá
  await page.reload();
  await page.goto(BASE + '#ranking');
  const rows = await page.locator('table.data tbody tr').count();
  if (rows < 1) errors.push('ranking vazio após recarregar');

  if (!celebrated) errors.push('nenhuma notificação de conquista exibida');
  await browser.close();
  return errors;
}

const desktop = await run('desktop', { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
const mobile = await run('mobile', { ...devices['iPhone 13'] });
const all = [...desktop.map((e) => 'desktop ' + e), ...mobile.map((e) => 'mobile ' + e)];
if (all.length) {
  console.error('ERROS:\n' + all.join('\n'));
  process.exit(1);
}
console.log('E2E OK — capturas em', OUT);
