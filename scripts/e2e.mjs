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
  const ctx = await browser.newContext(contextOpts);
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
      ...(await page.locator('.offers-panel [role=tab]').allTextContents()).map((t) => t.trim().split(/\s+/)[0]),
    ];
    const bad = texts.map((t) => t.trim()).filter((t) => !CATS.includes(t));
    if (bad.length) errors.push(`${where}: posições fora das 4 categorias: ${[...new Set(bad)].join(', ')}`);
  };
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: false });
  const step = (s) => console.log(`[${label}] ${s}`);

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
  await page.getByRole('button', { name: /Continuar →/i }).click();
  await page.waitForURL(/#campeonato/);
  // simula um jogo rápido e depois o restante
  await page.getByRole('button', { name: /Simular resultado/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Simular até o fim/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Simular$/ }).click();
  await page.waitForURL(/#resultado/);
  step('resultado');
  await page.waitForTimeout(1200);
  await shot('14-resultado');
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
