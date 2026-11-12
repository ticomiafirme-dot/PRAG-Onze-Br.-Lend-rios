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
  }
  await page.waitForURL(/#escalacao/, { timeout: 8000 });
}

async function toSeason() {
  await page.getByRole('button', { name: /Escolher capitão/i }).click();
  await page.locator('.captain-grid button.pcard').first().click();
  await page.getByRole('button', { name: /pré-temporada/i }).click();
  await page.getByRole('button', { name: /Iniciar temporada/i }).click();
  await page.waitForURL(/#campeonato/);
}

async function simulateAll() {
  await page.getByRole('button', { name: /Simular até o fim/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Simular$/ }).click();
  await page.waitForURL(/#resultado/);
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
const offers = await page.locator('.offers button.pcard').count();
if (offers > 3) errors.push(`Era Única: esperava até 3 ofertas por posição, veio ${offers}`);
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
await page.getByRole('button', { name: /Continuar →/i }).click();
await page.waitForURL(/#campeonato/);
await page.getByRole('tab', { name: /Mineiro/ }).click();
await shot('triplice-estadual');
await simulateAll();
await page.waitForSelector('.achievements');
const ach = await page.locator('.achievements li').allTextContents();
if (!ach.some((a) => /Tríplice Coroa/.test(a))) errors.push('Tríplice: conquista Tríplice Coroa não listada');
await shot('triplice-resultado');

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
