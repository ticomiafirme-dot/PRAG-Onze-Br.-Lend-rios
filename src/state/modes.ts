// Nomes e descrições dos modos de jogo.
import type { GameMode } from '../engine/draft';

export const MODE_INFO: Record<GameMode, { name: string; short: string; description: string }> = {
  classico: {
    name: 'Clássico',
    short: 'Clássico',
    description: 'Escolha um clube. A cada rodada do draft uma década da história dele é sorteada.',
  },
  era: {
    name: 'Era Única',
    short: 'Era Única',
    description: 'Clube e década fixos. A cada rodada, três jogadores daquela era são sorteados por categoria (GOL, DEF, MEI, ATA).',
  },
  mistura: {
    name: 'Mistura Brasileira',
    short: 'Mistura',
    description: 'O jogo sorteia clube e década a cada rodada. Monte o elenco sem escolher a origem.',
  },
  diario: {
    name: 'Desafio Diário',
    short: 'Diário',
    description: 'Mesmo clube, mesma década e mesmos sorteios para todos. Uma tentativa por dia.',
  },
  semanal: {
    name: 'Desafio Semanal',
    short: 'Semanal',
    description: 'Um clube diferente por semana, com sorteios iguais para todos e rivais mais fortes.',
  },
  triplice: {
    name: 'Tríplice Coroa',
    short: 'Tríplice',
    description: 'Estadual, Copa do Brasil e Brasileirão na mesma temporada. Vença os três.',
  },
};
