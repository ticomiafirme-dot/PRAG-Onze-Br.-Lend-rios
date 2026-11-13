import type { Card, Club, Decade, PlayerRecord, Position } from '../data/types';
import { DECADES, ROLE_CATEGORY } from '../data/types';

/**
 * Banco de dados em memória com índices para o draft.
 * Recebe clubes e jogadores por injeção (facilita testes com dados sintéticos).
 */
export class Database {
  readonly clubs: Club[];
  readonly clubById = new Map<string, Club>();
  readonly playersByClub = new Map<string, PlayerRecord[]>();
  readonly cardsByClubDecade = new Map<string, Card[]>();
  readonly cardByKey = new Map<string, Card>();
  /** Registros de uma mesma pessoa em clubes diferentes. */
  readonly recordsByPerson = new Map<string, { club: string; record: PlayerRecord }[]>();

  constructor(clubs: Club[], playersByClub: Record<string, PlayerRecord[]>) {
    this.clubs = clubs;
    for (const club of clubs) {
      this.clubById.set(club.id, club);
      const players = playersByClub[club.id] ?? [];
      this.playersByClub.set(club.id, players);
      for (const p of players) {
        const positions = positionsOf(p);
        const list = this.recordsByPerson.get(p.id) ?? [];
        list.push({ club: club.id, record: p });
        this.recordsByPerson.set(p.id, list);
        for (const d of DECADES) {
          const ovr = p.eras[d];
          if (ovr == null || !club.decades.includes(d)) continue;
          const card: Card = { key: cardKey(p.id, club.id, d), id: p.id, club: club.id, decade: d, overall: ovr, player: p, positions };
          const k = clubDecadeKey(club.id, d);
          const arr = this.cardsByClubDecade.get(k) ?? [];
          arr.push(card);
          this.cardsByClubDecade.set(k, arr);
          this.cardByKey.set(card.key, card);
        }
      }
    }
    for (const arr of this.cardsByClubDecade.values()) arr.sort((a, b) => b.overall - a.overall);
  }

  club(id: string): Club {
    const c = this.clubById.get(id);
    if (!c) throw new Error(`Clube desconhecido: ${id}`);
    return c;
  }

  cards(clubId: string, decade: Decade): Card[] {
    return this.cardsByClubDecade.get(clubDecadeKey(clubId, decade)) ?? [];
  }

  card(key: string): Card {
    const c = this.cardMaybe(key);
    if (!c) throw new Error(`Carta desconhecida: ${key}`);
    return c;
  }

  /** Carta pela chave, aceitando chaves antigas de registros corrigidos (partidas e históricos salvos). */
  cardMaybe(key: string | null | undefined): Card | undefined {
    if (!key) return undefined;
    return this.cardByKey.get(key) ?? this.cardByKey.get(LEGACY_CARD_KEYS[key] ?? '');
  }

  /** Décadas do clube que realmente têm jogadores cadastrados. */
  decadesOf(clubId: string): Decade[] {
    const club = this.club(clubId);
    return club.decades.filter((d) => this.cards(clubId, d).length > 0);
  }

  allCardsOfClub(clubId: string): Card[] {
    return this.decadesOf(clubId).flatMap((d) => this.cards(clubId, d));
  }

  /** Clubes (ids) por onde a pessoa passou, dentro da base do jogo. */
  clubsOfPerson(personId: string): string[] {
    return (this.recordsByPerson.get(personId) ?? []).map((r) => r.club);
  }
}

/**
 * Chaves de cartas que mudaram por correção de dados. Ex.: o Robinho do Santos
 * (Robson de Souza) estava ligado por engano ao Róbson Michael Signorini.
 */
export const LEGACY_CARD_KEYS: Record<string, string> = {
  'robson-michael-signorini@santos@2000s': 'robinho@santos@2000s',
  'robson-michael-signorini@santos@2010s': 'robinho@santos@2010s',
};

export function cardKey(id: string, club: string, decade: Decade): string {
  return `${id}@${club}@${decade}`;
}

export function clubDecadeKey(club: string, decade: Decade): string {
  return `${club}|${decade}`;
}

/**
 * Categorias de um jogador: a da função principal e, se ele também atuou em
 * funções de outra categoria (ex.: lateral que jogou no meio), essa também.
 */
export function positionsOf(p: PlayerRecord): Position[] {
  const out: Position[] = [ROLE_CATEGORY[p.position] ?? 'MEI'];
  for (const r of p.secondary) {
    const c = ROLE_CATEGORY[r];
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** A carta pode ocupar uma vaga desta categoria? */
export function canPlay(card: Card, pos: Position): boolean {
  return card.positions.includes(pos);
}
