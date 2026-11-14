import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../router';
import { useGame } from '../state/store';
import { COMP_NAMES, matchKey, simulateUserMatch, USER_ID, userFixture } from '../engine/campaign';
import { formatMinute, type MatchEvent, type MatchResult, type Side } from '../engine/match';
import { aggregate, simulateShootout } from '../engine/cup';
import { subSeed } from '../engine/rng';
import { POSITION_NAMES, toPosition } from '../data/types';
import { TeamCrest } from '../components/TeamBadge';
import { Confetti, NeedRun } from '../components/ui';
import type { TeamSheet } from '../engine/team';
import { PlayerFaceByKey } from '../components/PlayerFace';
import { PenaltyShootout } from '../components/PenaltyShootout';

const MS_PER_MINUTE_1X = 600;
const TICK_MS = 100;

const ICON: Record<string, string> = {
  kickoff: '⏱️',
  goal: '⚽',
  'penalty-goal': '⚽',
  save: '🧤',
  miss: '💨',
  post: '🥅',
  yellow: '🟨',
  red: '🟥',
  'penalty-miss': '❌',
  offside: '🚩',
  halftime: '⏸️',
  fulltime: '🏁',
};

export function MatchScreen() {
  const run = useGame((s) => s.run);
  const ok = !!run?.campaign && !run.campaign.finished && !!userFixture(run.campaign);
  return (
    <NeedRun ok={ok}>
      <MatchInner />
    </NeedRun>
  );
}

function MatchInner() {
  const run = useGame((s) => s.run)!;
  const c = run.campaign!;
  const completeUserMatch = useGame((s) => s.completeUserMatch);
  const speed = useGame((s) => s.settings.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const sim = useMemo(() => simulateUserMatch(c)!, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { result, day, fixture } = sim;
  const home = c.teams[result.home];
  const away = c.teams[result.away];
  const st0 = result.stoppage[0];
  const total = 90 + st0 + result.stoppage[1];
  const posOf = (e: MatchEvent) => (e.half === 1 ? e.minute + (e.extra ?? 0) : 45 + st0 + (e.minute - 45) + (e.extra ?? 0));

  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [flash, setFlash] = useState<MatchEvent | null>(null);
  const [tab, setTab] = useState<'lances' | 'estatisticas' | 'escalacoes'>('lances');
  const [pkDone, setPkDone] = useState(false);
  const done = clock >= total;
  const seenGoals = useRef(0);

  useEffect(() => {
    if (!playing || done) return;
    const id = setInterval(() => {
      setClock((t) => Math.min(total, t + (TICK_MS * speed) / MS_PER_MINUTE_1X));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, done, total]);

  const visible = result.events.filter((e) => posOf(e) <= clock || done);
  const goals = visible.filter((e) => e.type === 'goal' || e.type === 'penalty-goal');
  const score: [number, number] = [goals.filter((g) => g.side === 'home').length, goals.filter((g) => g.side === 'away').length];

  useEffect(() => {
    if (goals.length > seenGoals.current) {
      const g = goals[goals.length - 1];
      seenGoals.current = goals.length;
      if (!done || clock < total) {
        setFlash(g);
        const t = setTimeout(() => setFlash(null), 1800 / Math.max(1, speed / 1.5));
        return () => clearTimeout(t);
      }
    }
  }, [goals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // minuto exibido
  const matchMinute = clock <= 45 + st0 ? Math.min(clock, 45 + st0) : clock - st0;
  const clockLabel = done
    ? 'Fim'
    : clock <= 45
      ? `${Math.floor(clock)}'`
      : clock <= 45 + st0
        ? `45+${Math.ceil(clock - 45)}'`
        : matchMinute <= 90
          ? `${Math.floor(matchMinute)}'`
          : `90+${Math.ceil(matchMinute - 90)}'`;
  const half = clock <= 45 + st0 ? '1º tempo' : '2º tempo';

  // estatísticas ao vivo
  const snap = done ? result.snapshots[result.snapshots.length - 1] : [...result.snapshots].reverse().find((s) => s.minute <= matchMinute) ?? null;
  const cards = (side: Side, t: string) => visible.filter((e) => e.side === side && e.type === t).length;

  // posição da bola: vai para o lado do último lance de ataque
  const lastAttack = [...visible].reverse().find((e) => ['goal', 'penalty-goal', 'save', 'miss', 'post', 'offside', 'penalty-miss'].includes(e.type));
  const ballX = !lastAttack || clock - posOf(lastAttack) > 3 ? 50 : lastAttack.side === 'home' ? 88 : 12;

  // mata-mata: agregado e pênaltis
  const knockout = useMemo(() => {
    if (day.leg !== 2) return null;
    const cup = day.comp === 'copa' ? c.copa : c.estadual;
    const tie = cup?.stages[day.stage!]?.ties.find((t) => t.a === USER_ID || t.b === USER_ID);
    if (!tie) return null;
    const results = new Map(c.results.map((m) => [m.key, m]));
    const key = matchKey(day, fixture);
    results.set(key, { comp: day.comp, key, home: result.home, away: result.away, score: result.score, seed: result.seed, goals: [] });
    const t2 = { ...tie, legs: [tie.legs[0], key] };
    const [ga, gb] = aggregate(t2, results);
    const so = ga === gb ? simulateShootout(c.teams[fixture.home], c.teams[fixture.away], subSeed(c.seed, key)) : null;
    return { ga, gb, a: tie.a, b: tie.b, so };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const userSide: Side = result.home === USER_ID ? 'home' : 'away';
  const userWon = result.score[userSide === 'home' ? 0 : 1] > result.score[userSide === 'home' ? 1 : 0];

  const finish = () => {
    completeUserMatch(result);
    const after = useGame.getState().run?.campaign;
    navigate(after?.finished ? '/resultado' : '/campeonato');
  };

  return (
    <div className="page match-page">
      <div className="eyebrow" style={{ textAlign: 'center' }}>
        {COMP_NAMES[day.comp]} · {day.label.split(' · ').slice(1).join(' · ')}
      </div>

      <div className="scoreboard" style={{ ['--hc' as string]: home.colors.primary, ['--ac' as string]: away.colors.primary }}>
        <TeamBlock t={home} />
        <div className="score-center">
          <div className={`score ${flash ? 'score-pop' : ''}`} key={score.join('-')}>
            <span>{score[0]}</span>
            <span className="score-x">×</span>
            <span>{score[1]}</span>
          </div>
          <div className="clock">
            <span className={`live-dot ${done ? 'off' : ''}`} /> {clockLabel} <span className="dim">· {done ? 'encerrado' : half}</span>
          </div>
        </div>
        <TeamBlock t={away} />
      </div>

      <div className="mini-field" aria-hidden="true">
        <span className="mini-goal l" />
        <span className="mini-goal r" />
        <span className="mini-center" />
        <span className="ball" style={{ left: `${ballX}%` }} />
        <div className="progress" style={{ width: `${(100 * clock) / total}%` }} />
      </div>

      <div className="controls">
        <button className="btn btn-ghost btn-sm" onClick={() => setPlaying((p) => !p)} disabled={done}>
          {playing ? '❚❚ Pausar' : '▶ Continuar'}
        </button>
        {[1, 2, 4].map((s) => (
          <button key={s} className={`btn btn-sm ${speed === s ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSpeed(s as 1 | 2 | 4)} aria-pressed={speed === s}>
            {s}x
          </button>
        ))}
        <button className="btn btn-blue btn-sm" onClick={() => setClock(total)} disabled={done}>
          Pular para o final ⏭
        </button>
      </div>

      {done && (
        <div className="panel fulltime">
          {userWon && <Confetti count={60} />}
          <h2>{userWon ? 'Vitória!' : result.score[0] === result.score[1] ? 'Empate' : 'Derrota'}</h2>
          {result.mvp && (
            <p className="muted">
              Craque do jogo: <strong className="gold-text">{result.mvp.name}</strong> ({c.teams[result.mvp.side === 'home' ? result.home : result.away].short})
            </p>
          )}
          {knockout && (
            <p className="muted">
              Agregado: {c.teams[knockout.a].short} {knockout.ga} × {knockout.gb} {c.teams[knockout.b].short}
              {knockout.so && !pkDone && ' · empate no agregado: decisão nos pênaltis!'}
              {knockout.so && pkDone && (
                <>
                  {' '}
                  · Pênaltis: {c.teams[fixture.home].short} {knockout.so.score[0]} × {knockout.so.score[1]} {c.teams[fixture.away].short}
                </>
              )}
            </p>
          )}
          {knockout?.so && (
            <PenaltyShootout
              kicks={knockout.so.kicks}
              score={knockout.so.score}
              home={c.teams[fixture.home]}
              away={c.teams[fixture.away]}
              seed={result.seed}
              speed={speed}
              userSide={fixture.home === USER_ID ? 'home' : 'away'}
              onDone={() => setPkDone(true)}
            />
          )}
          {(!knockout?.so || pkDone) && (
            <button className="btn btn-gold btn-lg" onClick={finish}>
              Continuar →
            </button>
          )}
        </div>
      )}

      <div className="tabs" role="tablist" style={{ margin: '14px 0 10px', justifyContent: 'center' }}>
        {(
          [
            ['lances', 'Lances'],
            ['estatisticas', 'Estatísticas'],
            ['escalacoes', 'Escalações'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lances' && (
        <ol className="timeline">
          {[...visible].reverse().map((e) => (
            <li key={e.t} className={`ev ev-${e.type} ${e.side ? `side-${e.side}` : ''}`}>
              <span className="ev-min">{e.type === 'kickoff' ? "0'" : formatMinute(e)}</span>
              <span className="ev-icon">{ICON[e.type] ?? '•'}</span>
              <span className="ev-text">
                {e.text}
                {(e.type === 'goal' || e.type === 'penalty-goal') && (
                  <span className="ev-score">
                    {' '}
                    ({e.score[0]}–{e.score[1]})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {tab === 'estatisticas' && (
        <div className="panel match-stats">
          <StatRow label="Posse de bola" h={snap?.possession ?? 50} a={100 - (snap?.possession ?? 50)} suffix="%" />
          <StatRow label="Finalizações" h={snap?.home[0] ?? 0} a={snap?.away[0] ?? 0} />
          <StatRow label="No alvo" h={snap?.home[1] ?? 0} a={snap?.away[1] ?? 0} />
          <StatRow label="Defesas do goleiro" h={snap?.home[2] ?? 0} a={snap?.away[2] ?? 0} />
          <StatRow label="Escanteios" h={snap?.home[3] ?? 0} a={snap?.away[3] ?? 0} />
          <StatRow label="Faltas" h={snap?.home[4] ?? 0} a={snap?.away[4] ?? 0} />
          <StatRow label="Cartões amarelos" h={cards('home', 'yellow')} a={cards('away', 'yellow')} />
          <StatRow label="Cartões vermelhos" h={cards('home', 'red')} a={cards('away', 'red')} />
          {done && <StatRow label="Gols esperados (xG)" h={result.stats.home.xg} a={result.stats.away.xg} />}
          <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
            Substituições não fazem parte do jogo: o seu Onze Lendário atua os 90 minutos.
          </p>
        </div>
      )}

      {tab === 'escalacoes' && (
        <div className="lineups">
          <LineupList t={home} result={result} side="home" done={done} />
          <LineupList t={away} result={result} side="away" done={done} />
        </div>
      )}

      {flash && (
        <div className="goal-flash" style={{ ['--gc' as string]: (flash.side === 'home' ? home : away).colors.primary }}>
          <div className="goal-word">GOOOL!</div>
          <div className="goal-who">
            {flash.playerName} · {(flash.side === 'home' ? home : away).short}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamBlock({ t }: { t: TeamSheet }) {
  return (
    <div className={`team-block ${t.isUser ? 'is-user' : ''}`}>
      <TeamCrest team={t} size={52} />
      <strong>{t.name}</strong>
      <span className="dim">
        {t.isUser ? 'Seu time' : t.label} · {t.ratings.overall}
      </span>
    </div>
  );
}

function StatRow({ label, h, a, suffix = '' }: { label: string; h: number; a: number; suffix?: string }) {
  const total = h + a || 1;
  return (
    <div className="stat-row">
      <span className="stat-num">
        {h}
        {suffix}
      </span>
      <div className="stat-mid">
        <span className="stat-label">{label}</span>
        <div className="stat-bars">
          <span className="sb-h" style={{ width: `${(100 * h) / total}%` }} />
          <span className="sb-a" style={{ width: `${(100 * a) / total}%` }} />
        </div>
      </div>
      <span className="stat-num">
        {a}
        {suffix}
      </span>
    </div>
  );
}

function LineupList({ t, result, side, done }: { t: TeamSheet; result: MatchResult; side: Side; done: boolean }) {
  const lines = new Map(result.players[side].map((l) => [l.personId, l]));
  return (
    <div className="panel">
      <h3 className="row" style={{ fontSize: 20, marginBottom: 8 }}>
        <TeamCrest team={t} size={22} /> {t.name}
      </h3>
      <div className="lineup-rows">
        {t.players.map((p) => {
          const l = lines.get(p.personId);
          return (
            <div key={p.personId} className="lineup-row">
              <span className="num">{p.number}</span>
              <PlayerFaceByKey cardKey={p.cardKey} size={30} />
              <span className="grow">
                {p.name} {p.captain && <span className="cap-mini">C</span>}
                <span className="dim"> · {POSITION_NAMES[toPosition(p.pos)]}</span>
              </span>
              {done && l && (
                <span className="row" style={{ gap: 6 }}>
                  {l.goals > 0 && <span>{'⚽'.repeat(Math.min(l.goals, 4))}</span>}
                  {l.assists > 0 && <span className="dim">{l.assists}A</span>}
                  {l.yellow > 0 && <span>🟨</span>}
                  {l.red > 0 && <span>🟥</span>}
                  <span className={`rating ${l.rating >= 7.5 ? 'hi' : l.rating < 6 ? 'lo' : ''}`}>{l.rating.toFixed(1)}</span>
                </span>
              )}
              {!done && <span className="ovr-mini">{p.eff}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

