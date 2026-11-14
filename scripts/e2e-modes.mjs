#!/usr/bin/env node
// E2E dos modos adicionais: Mistura, Desafio Diário, Era Única e Tríplice Coroa.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'test-results/e2e-modes';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
});
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const log = (s) => console.log(s);

async function dismiss() {
  for (let i = 0; i < 25; i++) {
    const o = page.locator('.unlock-overlay');
    if (!(await o.count())) return;
    await o.locator('button', { hasText: /^Continuar/ }).first().click();
    await page.waitForTimeout(150);
  }
}

async function draftAll() {
  for (let r = 0; r < 11; r++) {
    await page.waitForSelector('.roulette.is-done', { timeout: 8000 });
    const card = page.locator('.offers button.pcard').first();
    try {
      await card.waitFor({ timeout: 2500 });
    } catch {
      /* sem ofertas: usa um novo sorteio */
    }
    if (!(await card.count())) {
      await page.getByRole('button', { name: /Sortear/i }).click();
      r--;
      continue;
    }
    await card.click();
    await page.waitForTimeout(120);
    if (await page.locator('.pos-chooser').count()) await page.locator('.pos-option').first().click();
  }
  await page.waitForURL(/#escalacao/, { timeout: 8000 });
  await dismiss();
}

async function toSeason() {
  await page.getByRole('button', { name: /Escolher capitão/i }).click();
  await page.locator('.captain-grid button.pcard').first().click();
  await page.getByRole('button', { name: /pré-temporada/i }).click();
  await page.getByRole('button', { name: /Iniciar temporada/i }).click();
  await page.waitForURL(/#campeonato/);
  await dismiss();
}

async function simulateAll() {
  await page.getByRole('button', { name: /Simular até o fim/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Simular$/ }).click();
  await page.waitForURL(/#resultado/);
  await page.waitForTimeout(500);
  await dismiss();
}

async function startFromHome(modeTitle) {
  await page.goto(BASE + '#inicio');
  await page.waitForSelector('.mode-card');
  const card = page.locator('.mode-card', { hasText: modeTitle });
  await card.getByRole('button', { name: /Jogar/ }).click();
  const dlg = page.getByRole('dialog');
  if (await dlg.count()) await dlg.getByRole('button', { name: /Começar/ }).click();
}

// 1) Mistura Brasileira
log('Mistura');
await startFromHome('Mistura Brasileira');
await page.waitForURL(/#formacao/);
await page.locator('.formation-card', { hasText: '4-4-2' }).click();
await page.getByRole('button', { name: /Iniciar draft/i }).click();
await page.waitForSelector('.roulette.is-done');
await shot('mistura-draft');
await draftAll();
const clubsInMix = await page.locator('.chip').filter({ hasText: /^[A-Z]{3}$/ }).count();
if (clubsInMix < 2) errors.push('Mistura: esperava jogadores de vários clubes');
await toSeason();
await simulateAll();
await shot('mistura-resultado');

// 2) Desafio Diário (uma tentativa)
log('Diário');
await startFromHome('Desafio Diário');
await page.waitForURL(/#draft/);
await shot('diario-draft');
await draftAll();
await toSeason();
await simulateAll();
await page.goto(BASE + '#inicio');
await page.waitForSelector('.mode-card');
const dailyBtn = page.locator('.mode-card', { hasText: 'Desafio Diário' }).getByRole('button');
if (!(await dailyBtn.isDisabled())) errors.push('Diário: deveria bloquear segunda tentativa no mesmo dia');
await shot('diario-bloqueado');

// 3) Era Única (Flamengo anos 80)
log('Era Única');
await page.goto(BASE + '#inicio');
await page.getByRole('button', { name: /Jogar agora|Novo jogo/ }).first().click();
const dlg3 = page.getByRole('dialog');
if (await dlg3.count()) await dlg3.getByRole('button', { name: /Começar/ }).click();
await page.locator('.club-tile', { hasText: 'Flamengo' }).click();
await page.locator('.decade-card', { hasText: 'Anos 80' }).click();
await page.waitForURL(/#formacao/);
await page.locator('.formation-card:not([disabled])').first().click();
await page.getByRole('button', { name: /Iniciar draft/i }).click();
await page.waitForSelector('.roulette.is-done');
// cada categoria oferece até 3 jogadores (a aba TODOS junta todas)
for (const cat of ['GOL', 'DEF', 'MEI', 'ATA']) {
  const tab = page.locator('.offers-panel [role=tab]', { hasText: new RegExp(`^${cat}`) });
  if (!(await tab.count())) continue;
  await tab.click();
  const offers = await page.locator('.offers button.pcard').count();
  if (offers > 3) errors.push(`Era Única: esperava até 3 ofertas em ${cat}, veio ${offers}`);
}
await page.locator('.offers-panel [role=tab]', { hasText: /^TODOS/ }).click();
await shot('era-draft');
await draftAll();
const decs = await page.locator('.pitch .pcard-decade').allTextContents();
if (decs.length !== 11 || decs.some((d) => d.trim() !== '80s')) errors.push(`Era Única: jogador fora da década escolhida (${decs.join(',')})`);
await toSeason();
await simulateAll();

// 4) Tríplice Coroa (Cruzeiro) — joga uma partida do estadual na tela de partida
log('Tríplice Coroa');
await startFromHome('Tríplice Coroa');
await page.waitForURL(/#clubes/);
await page.locator('.club-tile', { hasText: 'Cruzeiro' }).click();
await page.getByRole('button', { name: /Sortear décadas/i }).click();
await page.locator('.formation-card', { hasText: '4-2-3-1' }).click();
await page.getByRole('button', { name: /Iniciar draft/i }).click();
await draftAll();
await toSeason();
const label = await page.locator('.next-match .eyebrow').textContent();
if (!/Estadual/i.test(label ?? '')) errors.push(`Tríplice: primeiro jogo deveria ser do estadual (veio "${label}")`);
await shot('triplice-campeonato');
await page.getByRole('button', { name: /Jogar partida/i }).click();
await page.getByRole('button', { name: /Pular para o final/i }).click();
await page.waitForSelector('.fulltime');
// empate no agregado: a disputa de pênaltis é animada; pula para o fim
if (await page.locator('.pk-skip').count()) await page.locator('.pk-skip').click();
await page.getByRole('button', { name: /Continuar →/i }).click();
await page.waitForURL(/#campeonato/);
await dismiss();
// jogo de volta de mata-mata: o placar agregado aparece ao vivo junto do placar da partida
{
  let found = false;
  for (let n = 0; n < 80; n++) {
    if (/volta/i.test((await page.locator('.next-match .eyebrow').textContent().catch(() => '')) ?? '')) {
      found = true;
      break;
    }
    const next = page.getByRole('button', { name: /^(Simular resultado|Avançar)$/ });
    if (!(await next.count())) break;
    await next.first().click();
    await page.waitForTimeout(100);
    await dismiss();
  }
  if (!found) errors.push('Tríplice: nenhum jogo de volta encontrado para conferir o agregado');
  else {
    await page.getByRole('button', { name: /Jogar partida/i }).click();
    await page.waitForURL(/#partida/);
    const ok = await page.waitForSelector('.scoreboard .agg', { timeout: 5000 }).then(() => true, () => false);
    const text = ok ? ((await page.locator('.scoreboard .agg').textContent()) ?? '').replace(/\s+/g, ' ') : '';
    if (!ok || !/Agregado\s*\d+\s*×\s*\d+/.test(text) || !/Ida:/.test(text)) errors.push(`Tríplice: placar agregado no jogo de volta: "${text}"`);
    await shot('triplice-jogo-de-volta');
    await page.getByRole('button', { name: /Pular para o final/i }).click();
    await page.waitForSelector('.fulltime');
    const status = (await page.locator('.agg-status').textContent()) ?? '';
    if (!/se classifica|pênaltis/.test(status)) errors.push(`Tríplice: situação do agregado no fim: "${status}"`);
    if (await page.locator('.pk-skip').count()) await page.locator('.pk-skip').click();
    await page.getByRole('button', { name: /Continuar →/i }).click();
    await page.waitForURL(/#(campeonato|resultado)/);
    await dismiss();
  }
}
await page.getByRole('tab', { name: /Mineiro/ }).click();
await shot('triplice-estadual');
await simulateAll();
await page.waitForSelector('.achievements');
const ach = await page.locator('.achievements li').allTextContents();
if (!ach.some((a) => /Tríplice Coroa/.test(a))) errors.push('Tríplice: conquista Tríplice Coroa não listada');
await shot('triplice-resultado');

// encerrar a temporada: volta ao início sem partida em andamento; a temporada fica no histórico
await page.getByRole('button', { name: /Encerrar temporada/i }).click();
await page.waitForSelector('.hero');
if (!(await page.getByRole('button', { name: /Jogar agora/i }).count())) errors.push('Encerrar temporada: o início deveria oferecer "Jogar agora"');
await page.goto(BASE + '#historico');
await page.waitForSelector('.season-card');
if (!(await page.locator('.season-card', { hasText: 'Cruzeiro' }).count())) errors.push('Encerrar temporada: a temporada sumiu do histórico');

await page.goto(BASE + '#ranking');
const n = await page.locator('table.data tbody tr').count();
if (n < 4) errors.push(`Ranking: esperava ao menos 4 campanhas, veio ${n}`);
await shot('ranking');

await browser.close();
if (errors.length) {
  console.error('ERROS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('E2E modos OK');
