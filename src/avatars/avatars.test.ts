import { describe, expect, it } from 'vitest';
import { CLUBS, CLUB_BY_ID } from '../data/clubs';
import { db } from '../data/db';
import { tierOf } from '../components/cardTier';
import { allAvatarCards, filterAvatarCards } from '../components/AvatarPicker';
import { avatarKey, avatarMarkup, avatarRefOf, customAvatar, playerLook } from './index';
import { CLUB_KITS, goalkeeperKit, kitOf } from './kits';
import { decodeLook, generatedLook, lookCode } from './looks';
import { LOOKS } from './looksData';

const cards = [...db.cardByKey.values()];
const card = (id: string, club: string, decade: string) => {
  const c = db.cardByKey.get(`${id}@${club}@${decade}`);
  if (!c) throw new Error(`carta inexistente: ${id}@${club}@${decade}`);
  return c;
};

describe('avatares dos jogadores', () => {
  it('todas as cartas (jogador + clube + década) têm avatar válido', () => {
    expect(cards.length).toBeGreaterThan(3000);
    for (const c of cards) {
      const svg = avatarMarkup(avatarRefOf(c));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|null/);
    }
  });

  it('cada combinação jogador + clube tem o próprio avatar, com a camisa do clube', () => {
    const socCor = avatarMarkup(avatarRefOf(card('socrates-futebolista', 'corinthians', '1980s')));
    const socFla = avatarMarkup(avatarRefOf(card('socrates-futebolista', 'flamengo', '1980s')));
    const socSan = avatarMarkup(avatarRefOf(card('socrates-futebolista', 'santos', '1980s')));
    expect(new Set([socCor, socFla, socSan]).size).toBe(3);
    expect(socFla).toContain(CLUB_KITS.flamengo.colors[0]);
    expect(socFla).toContain(CLUB_KITS.flamengo.base);
    // o rosto (estrutura) é o mesmo nos três clubes
    const a = playerLook('socrates-futebolista', 'corinthians', '1980s');
    const b = playerLook('socrates-futebolista', 'flamengo', '1980s');
    expect({ ...a }).toEqual({ ...b });
  });

  it('sem conflito entre homônimos: a identidade é o id do jogador, não o nome', () => {
    const dudus = cards.filter((c) => c.player.name === 'Dudu');
    const ids = new Set(dudus.map((c) => c.id));
    expect(ids.size).toBeGreaterThan(1);
    const keys = new Set(dudus.map((c) => avatarKey(avatarRefOf(c))));
    expect(keys.size).toBe(dudus.length);
  });

  it('o visual acompanha a época do jogador no clube', () => {
    const gremio = playerLook('ronaldinho-gaucho', 'gremio', '1990s');
    const galo = playerLook('ronaldinho-gaucho', 'atletico-mg', '2010s');
    expect(gremio.hair).toBe('short');
    expect(galo.hair).toBe('wavy');
    expect(galo.headband).toBe(true);
    expect(playerLook('ronaldo-nazario', 'cruzeiro', '1990s').hair).toBe('buzz');
    expect(playerLook('ronaldo-nazario', 'corinthians', '2000s').hair).toBe('bald');
    expect(playerLook('neymar', 'santos', '2010s').hair).toBe('mohawk');
    expect(playerLook('romario', 'vasco', '2000s').hair).toBe('buzz');
  });

  it('aparência pesquisada: pele, cabelo e barba de jogadores conferidos nas fotos', () => {
    const memphis = playerLook('memphis-depay', 'corinthians', '2020s');
    expect([memphis.hair, memphis.facial]).toEqual(['cornrows', 'short-beard']);
    const cassio = playerLook('cassio-ramos', 'corinthians', '2010s');
    expect(cassio.hair).toBe('long');
    expect(playerLook('roger-guedes', 'corinthians', '2020s').hair).not.toBe('long');
    expect(playerLook('jairzinho', 'botafogo', '1970s').hair).toBe('afro');
  });

  it('códigos com cor dos olhos e novos penteados', () => {
    expect(decodeLook('x', '2Sdcv')?.eyes).toBe('green');
    expect(decodeLook('x', '1Sbsa')?.eyes).toBe('blue');
    expect(decodeLook('x', '5Ok0')?.eyes).toBe('dark');
    expect(decodeLook('x', '4Nkc')?.hair).toBe('cornrows');
    expect(decodeLook('x', '3Udc')?.hair).toBe('bun');
    expect(decodeLook('x', '9Zk0')).toBeNull();
  });

  it('sem pesquisa, o visual é neutro (sem traços marcantes inventados)', () => {
    for (let i = 0; i < 200; i++) {
      const look = generatedLook(`teste-${i}`, i % 2 ? '1970s' : '2010s');
      expect(look.curated).toBe(false);
      expect([3, 4]).toContain(look.skin);
      expect(['short', 'part', 'buzz']).toContain(look.hair);
      expect(look.facial).toBe('none');
      expect(['black', 'dark']).toContain(look.hairColor);
    }
  });

  it('a curadoria de aparência é válida e aponta para jogadores existentes', () => {
    const ids = new Set(cards.map((c) => c.id));
    for (const [id, entry] of Object.entries(LOOKS)) {
      expect(ids.has(id), id).toBe(true);
      const codes = typeof entry === 'string' ? [entry] : Object.values(entry);
      for (const code of codes) expect(decodeLook(id, code), `${id}: ${code}`).not.toBeNull();
    }
    expect(lookCode({ base: 'a', '1990s': 'b', gremio: 'c', 'gremio@2000s': 'd' }, 'gremio', '2000s')).toBe('d');
    expect(lookCode({ base: 'a', '1990s': 'b', gremio: 'c' }, 'gremio', '1990s')).toBe('c');
    expect(lookCode({ base: 'a', '1990s': 'b' }, 'santos', '1990s')).toBe('b');
    expect(lookCode({ base: 'a', '1990s': 'b' }, 'santos', '2010s')).toBe('a');
  });

  it('todos os clubes têm uniforme; goleiros usam camisa de goleiro', () => {
    for (const c of CLUBS) expect(CLUB_KITS[c.id], c.id).toBeDefined();
    const club = CLUB_BY_ID.corinthians;
    const gk = goalkeeperKit(club, 'cassio-ramos', '2010s');
    expect(gk.base).not.toBe(kitOf(club).base);
    const cassio = cards.find((c) => c.id === 'cassio-ramos')!;
    expect(avatarRefOf(cassio).goalkeeper).toBe(true);
  });

  it('o fundo segue a cor da carta', () => {
    const pele = card('pele', 'santos', '1960s');
    expect(tierOf(pele.overall)).toBe('lenda');
    const lenda = avatarMarkup(avatarRefOf(pele));
    const elenco = avatarMarkup(avatarRefOf(pele, 'elenco'));
    expect(lenda).toContain('#f4bd16');
    expect(elenco).toContain('#3c4968');
  });

  it('sem ilustração própria, usa o avatar gerado', () => {
    expect(customAvatar({ playerId: 'pele', clubId: 'santos', decade: '1960s' })).toBeNull();
  });
});

describe('escolha da foto de perfil', () => {
  const all = allAvatarCards();

  it('lista todos os avatares, dos maiores overalls para os menores', () => {
    expect(all.length).toBe(cards.length);
    expect(all[0].overall).toBeGreaterThanOrEqual(all[all.length - 1].overall);
  });

  it('filtra por clube, por década e pelo nome (sem diferenciar acentos)', () => {
    const santos60 = filterAvatarCards(all, { club: 'santos', decade: '1960s' });
    expect(santos60.length).toBeGreaterThan(5);
    expect(santos60.every((c) => c.club === 'santos' && c.decade === '1960s')).toBe(true);
    expect(santos60.some((c) => c.id === 'pele')).toBe(true);
    const socrates = filterAvatarCards(all, { query: 'socrates' });
    expect(new Set(socrates.map((c) => c.club))).toEqual(new Set(['corinthians', 'flamengo', 'santos']));
    expect(filterAvatarCards(all, { query: 'SÓCRATES', club: 'flamengo' }).every((c) => c.club === 'flamengo')).toBe(true);
    expect(filterAvatarCards(all, { query: 'zzzz-nao-existe' })).toEqual([]);
  });
});
