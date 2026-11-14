import { describe, expect, it } from 'vitest';
import { planKick } from './PenaltyShootout';

describe('animação dos pênaltis', () => {
  const kick = (scored: boolean) => ({ side: 'home' as const, name: 'X', scored });

  it('a encenação respeita o resultado sorteado: gol entra, cobrança perdida não', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (let i = 0; i < 12; i++) {
        const g = planKick(kick(true), i, seed);
        expect(g.outcome).toBe('goal');
        // a bola termina dentro do gol (entre as traves e abaixo do travessão)
        expect(g.ball.x).toBeGreaterThan(14);
        expect(g.ball.x).toBeLessThan(86);
        expect(g.ball.y).toBeGreaterThan(15);
        expect(g.ball.y).toBeLessThan(63);
        const m = planKick(kick(false), i, seed);
        expect(['save', 'over', 'post']).toContain(m.outcome);
        if (m.outcome === 'save') {
          // na defesa, as luvas vão exatamente aonde a bola vai
          expect(Math.abs(m.keeper.x - m.ball.x)).toBeLessThan(0.01);
        }
        if (m.outcome === 'over') expect(m.ball.y).toBeLessThan(14);
      }
    }
  });

  it('é sempre a mesma encenação para a mesma partida', () => {
    expect(planKick(kick(true), 3, 99)).toEqual(planKick(kick(true), 3, 99));
  });

  it('mistura defesas e chutes para fora entre as cobranças perdidas', () => {
    const outs = Array.from({ length: 200 }, (_, n) => planKick(kick(false), n % 12, n).outcome);
    expect(outs.filter((o) => o === 'save').length).toBeGreaterThan(100);
    expect(outs.filter((o) => o !== 'save').length).toBeGreaterThan(20);
  });
});
