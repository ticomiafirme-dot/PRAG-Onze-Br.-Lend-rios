import { useMemo, useState } from 'react';
import { CLUB_BY_ID } from '../data/clubs';
import { db, LEAGUE_CLUBS } from '../data/db';
import { decadeLabel } from '../data/types';
import { navigate } from '../router';
import { MODE_INFO, resumeRoute, useGame } from '../state/store';
import { challengeRecord } from '../state/storage';
import { dailyChallenge, weeklyChallenge } from '../engine/challenges';
import type { GameMode } from '../engine/draft';
import { LogoMark } from '../components/Logo';
import { Crest } from '../components/Crest';
import { Modal } from '../components/ui';

const PHASE_LABEL: Record<string, string> = {
  setup: 'Preparação',
  draft: 'Draft em andamento',
  lineup: 'Escalação',
  captain: 'Escolha do capitão',
  preseason: 'Pré-temporada',
  season: 'Temporada em andamento',
  finished: 'Temporada encerrada',
};

export function Home() {
  const run = useGame((s) => s.run);
  const startMode = useGame((s) => s.startMode);
  const abandon = useGame((s) => s.abandon);
  const [pending, setPending] = useState<GameMode | null>(null);

  const ids = LEAGUE_CLUBS.map((c) => c.id);
  const daily = useMemo(() => dailyChallenge(db, ids), []); // eslint-disable-line react-hooks/exhaustive-deps
  const weekly = useMemo(() => weeklyChallenge(ids), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Desafio já tentado: bloqueado, exceto se for a partida em andamento (aí vira "Continuar")
  const inProgress = (key: string) => run?.challenge?.key === key && run.phase !== 'finished';
  const dailyDone = !!challengeRecord(daily.key) && !inProgress(daily.key);
  const weeklyDone = !!challengeRecord(weekly.key) && !inProgress(weekly.key);

  const totals = useMemo(() => {
    let records = 0;
    for (const list of db.playersByClub.values()) records += list.length;
    return { records, persons: db.recordsByPerson.size };
  }, []);

  const go = (mode: GameMode) => {
    if (run && run.phase !== 'finished') {
      setPending(mode);
      return;
    }
    navigate(startMode(mode));
  };
  const confirm = () => {
    if (!pending) return;
    const m = pending;
    setPending(null);
    navigate(startMode(m));
  };

  const runClub = run?.clubId ? CLUB_BY_ID[run.clubId] : null;

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-mark">
          <LogoMark size={120} />
        </div>
        <div className="hero-copy">
          <div className="eyebrow">Futebol brasileiro · lendas · temporada perfeita</div>
          <h1 className="hero-title">
            Onze BR <span className="gold-text">Lendário</span> <small>PRAG</small>
          </h1>
          <p className="hero-sub">
            Escolha um clube, sorteie décadas da sua história e escale os ídolos que marcaram época. Depois, encare o Brasileirão:
            38 rodadas para tentar a campanha perfeita.
          </p>
          <div className="row wrap hero-ctas">
            {run && run.phase !== 'finished' ? (
              <>
                <button className="btn btn-gold btn-lg" onClick={() => navigate(resumeRoute(run))}>
                  Continuar
                </button>
                <button className="btn btn-ghost" onClick={() => go('classico')}>
                  Novo jogo
                </button>
              </>
            ) : (
              <button className="btn btn-gold btn-lg" onClick={() => go('classico')}>
                Jogar agora
              </button>
            )}
            <a className="btn btn-ghost" href="#como-jogar">
              Como jogar
            </a>
          </div>
          {run && run.phase !== 'finished' && (
            <div className="resume-card">
              {runClub && <Crest club={runClub} size={28} />}
              <div className="grow">
                <strong>{runClub?.name ?? 'Mistura Brasileira'}</strong>
                <span className="dim">
                  {' '}
                  · {MODE_INFO[run.mode].name} · {PHASE_LABEL[run.phase]}
                  {run.campaign ? ` · ${run.campaign.dayIndex}/${run.campaign.calendar.length} jogos` : ''}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={abandon}>
                Abandonar
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <strong>{LEAGUE_CLUBS.length}</strong> clubes no Brasileirão
        </div>
        <div>
          <strong>{totals.persons.toLocaleString('pt-BR')}</strong> jogadores históricos
        </div>
        <div>
          <strong>1950–2020</strong> décadas verificadas
        </div>
        <div>
          <strong>6</strong> formações táticas
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Modos de jogo</h2>
        <div className="mode-grid">
          <ModeCard mode="classico" tag="Principal" onPlay={() => go('classico')} />
          <ModeCard mode="mistura" onPlay={() => go('mistura')} />
          <ModeCard
            mode="diario"
            tag={dailyDone ? 'Concluído hoje' : 'Novo hoje'}
            disabled={dailyDone}
            extra={
              <span className="row" style={{ gap: 8 }}>
                <Crest club={CLUB_BY_ID[daily.clubId]} size={20} /> {CLUB_BY_ID[daily.clubId].name} · {daily.decade ? decadeLabel(daily.decade) : ''} ·{' '}
                {daily.formationId}
              </span>
            }
            onPlay={() => (inProgress(daily.key) ? navigate(resumeRoute(run)) : go('diario'))}
          />
          <ModeCard
            mode="semanal"
            tag={weeklyDone ? 'Concluído' : 'Esta semana'}
            disabled={weeklyDone}
            extra={
              <span className="row" style={{ gap: 8 }}>
                <Crest club={CLUB_BY_ID[weekly.clubId]} size={20} /> {CLUB_BY_ID[weekly.clubId].name} · {weekly.formationId} · Difícil
              </span>
            }
            onPlay={() => (inProgress(weekly.key) ? navigate(resumeRoute(run)) : go('semanal'))}
          />
          <ModeCard mode="triplice" onPlay={() => go('triplice')} />
          <ModeCard mode="era" tag="Pela página do clube" onPlay={() => go('classico')} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Como funciona</h2>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <strong>Escolha o clube e a formação.</strong> Cada clube tem as décadas em que fez história, com jogadores verificados.
          </li>
          <li>
            <span className="step-n">2</span>
            <strong>Draft por sorteio.</strong> A cada rodada uma década é sorteada; escolha um jogador dela para uma vaga livre (GOL, DEF, MEI ou ATA). Você
            tem 5 novos sorteios.
          </li>
          <li>
            <span className="step-n">3</span>
            <strong>Química e capitão.</strong> Ligações por clube, década e nacionalidade aumentam a força. O capitão ganha +3 e pesa em
            dobro.
          </li>
          <li>
            <span className="step-n">4</span>
            <strong>Brasileirão.</strong> 38 rodadas contra os grandes clubes escalados com suas próprias lendas. Busque o 38–0–0.
          </li>
        </ol>
      </section>

      {pending && (
        <Modal label="Começar novo jogo" onClose={() => setPending(null)}>
          <h3 style={{ fontSize: 26, marginBottom: 8 }}>Começar um novo jogo?</h3>
          <p className="muted">
            Você tem uma campanha em andamento. Ao iniciar o modo <strong>{MODE_INFO[pending].name}</strong>, ela será descartada.
          </p>
          <div className="row wrap" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancelar
            </button>
            <button className="btn btn-gold" onClick={confirm}>
              Começar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ModeCard({
  mode,
  tag,
  extra,
  disabled,
  onPlay,
}: {
  mode: GameMode;
  tag?: string;
  extra?: React.ReactNode;
  disabled?: boolean;
  onPlay: () => void;
}) {
  const info = MODE_INFO[mode];
  return (
    <article className={`mode-card mode-${mode} ${disabled ? 'is-disabled' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{info.name}</h3>
        {tag && <span className={`chip ${disabled ? '' : 'chip-gold'}`}>{tag}</span>}
      </div>
      <p className="muted">{info.description}</p>
      {extra && <div className="mode-extra">{extra}</div>}
      <button className="btn btn-blue btn-sm" disabled={disabled} onClick={onPlay}>
        {disabled ? (mode === 'semanal' ? 'Volte na próxima semana' : 'Volte amanhã') : 'Jogar'}
      </button>
    </article>
  );
}
