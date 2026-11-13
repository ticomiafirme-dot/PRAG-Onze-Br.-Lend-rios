// Persistência local (localStorage) com tolerância a falhas: em navegação
// privada ou com armazenamento bloqueado, o jogo continua funcionando.

export const STORAGE_PREFIX = 'onze-br-lendario:v1';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Ranking (melhores campanhas neste dispositivo)

export interface RankingEntry {
  id: string;
  date: string;
  mode: string;
  modeLabel: string;
  challengeKey: string | null;
  clubId: string | null;
  teamName: string;
  formationId: string;
  difficulty: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  position: number;
  perfect: boolean;
  champion: boolean;
  triple: boolean;
  overall: number;
  chem: number;
  captain: string;
  /** Conta (Supabase) de quem jogou, quando conectado: o nome exibido é o atual da conta. */
  accountId?: string | null;
  /** Avatar de jogador usado como foto de perfil quando a campanha terminou. */
  avatar?: string | null;
  playerName: string;
}

const RANKING_KEY = 'ranking';
const MAX_ENTRIES = 300;

export function rankingScore(e: Pick<RankingEntry, 'points' | 'wins' | 'gf' | 'ga'>): number {
  return e.points * 1_000_000 + e.wins * 10_000 + (e.gf - e.ga + 500) * 10 + Math.min(9, Math.floor(e.gf / 20));
}

export function loadRanking(): RankingEntry[] {
  return readJSON<RankingEntry[]>(RANKING_KEY, []);
}

export function addRankingEntry(entry: RankingEntry): RankingEntry[] {
  const list = loadRanking().filter((e) => e.id !== entry.id);
  list.push(entry);
  list.sort((a, b) => rankingScore(b) - rankingScore(a));
  const trimmed = list.slice(0, MAX_ENTRIES);
  writeJSON(RANKING_KEY, trimmed);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Tentativas de desafios (uma por dia/semana)

interface ChallengeRecord {
  startedAt: string;
  finished: boolean;
}

export function challengeRecord(key: string): ChallengeRecord | null {
  return readJSON<Record<string, ChallengeRecord>>('challenges', {})[key] ?? null;
}

export function markChallenge(key: string, finished: boolean): void {
  const all = readJSON<Record<string, ChallengeRecord>>('challenges', {});
  all[key] = { startedAt: all[key]?.startedAt ?? new Date().toISOString(), finished: finished || all[key]?.finished || false };
  writeJSON('challenges', all);
}

export function loadPlayerName(): string {
  return readJSON<string>('player-name', '');
}

export function savePlayerName(name: string): void {
  writeJSON('player-name', name.slice(0, 24));
}

/** Avatar de jogador escolhido como foto de perfil do visitante (neste aparelho). */
export function loadProfileAvatar(): string | null {
  return readJSON<string | null>('profile-avatar', null);
}

export function saveProfileAvatar(key: string | null): void {
  writeJSON('profile-avatar', key);
}
