// Disputa de pênaltis animada: o gol de frente, as luvas do goleiro e a bola.
// Mostra as cobranças já sorteadas pelo motor (5 alternadas e, se empatar,
// alternadas até alguém errar): a animação só encena o resultado.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toPosition } from '../data/types';
import type { ShootoutKick } from '../engine/cup';
import type { Side } from '../engine/match';
import { Rng, subSeed } from '../engine/rng';
import type { TeamSheet } from '../engine/team';
import { TeamCrest } from './TeamBadge';
import { Confetti } from './ui';

type Outcome = 'goal' | 'save' | 'over' | 'post';
type Phase = 'ready' | 'shoot' | 'result';

interface Pos {
  x: number;
  y: number;
}

interface Plan {
  outcome: Outcome;
  /** Onde a bola chega (em % do quadro). */
  ball: Pos & { s: number };
  /** Para onde a bola vai depois (rede, rebote, fora). */
  after: Pos & { s: number; o: number };
  /** Mergulho do goleiro (centro das luvas) e giro. */
  keeper: Pos & { r: number };
}

const CALL: Record<Outcome, string> = { goal: 'GOL!', save: 'DEFENDEU!', over: 'PRA FORA!', post: 'NA TRAVE!' };

const REST_BALL = { x: 50, y: 88, s: 1 };
const REST_KEEPER = { x: 50, y: 47, r: 0 };

/** Encenação de cada cobrança: canto, altura, mergulho e o que acontece depois. */
export function planKick(k: ShootoutKick, i: number, seed: number): Plan {
  const r = new Rng(subSeed(seed, `penaltis-animacao:${i}`));
  const outcome: Outcome = k.scored ? 'goal' : r.chance(0.7) ? 'save' : r.chance(0.55) ? 'over' : 'post';
  const col = outcome === 'post' ? (r.chance(0.5) ? -1 : 1) : r.chance(0.18) ? 0 : r.chance(0.5) ? -1 : 1;
  const high = r.chance(0.45);
  const jitter = (n: number) => (r.next() * 2 - 1) * n;
  const ball = { x: 50 + col * 24 + jitter(3), y: (high ? 31 : 55) + jitter(2), s: 0.46 };
  if (outcome === 'over') Object.assign(ball, { x: 32 + r.next() * 36, y: 5, s: 0.4 });
  if (outcome === 'post') Object.assign(ball, { x: col < 0 ? 12.5 : 87.5, y: 26 + r.next() * 22, s: 0.46 });

  // goleiro: no gol, vai para o lado errado; na defesa, encontra a bola
  let kc = outcome === 'goal' ? (col === 0 ? (r.chance(0.5) ? -1 : 1) : -col) : outcome === 'save' ? col : r.chance(0.5) ? -1 : 1;
  if (outcome === 'goal' && col !== 0 && r.chance(0.2)) kc = 0; // às vezes fica parado e só vê a bola entrar
  const kHigh = outcome === 'save' ? high : r.chance(0.5);
  const keeper =
    outcome === 'save'
      ? { x: ball.x, y: ball.y + 1, r: col * (high ? 30 : 62) }
      : { x: 50 + kc * 23, y: kc === 0 ? (kHigh ? 38 : 50) : kHigh ? 36 : 54, r: kc * (kHigh ? 34 : 68) };

  const side = col === 0 ? (r.chance(0.5) ? -1 : 1) : col;
  const after =
    outcome === 'goal'
      ? { x: ball.x + jitter(1.5), y: ball.y - 3, s: 0.38, o: 1 }
      : outcome === 'save'
        ? { x: ball.x + side * 17, y: Math.min(80, ball.y + 24), s: 0.56, o: 0.9 }
        : outcome === 'over'
          ? { x: ball.x + jitter(8), y: -14, s: 0.3, o: 0 }
          : { x: ball.x - col * 9, y: Math.min(84, ball.y + 32), s: 0.58, o: 0.9 };
  return { outcome, ball, after, keeper };
}

/** Durações de cada fase (ms), mais curtas nas velocidades 2x e 4x. */
function timings(speed: number) {
  const f = speed >= 4 ? 0.42 : speed >= 2 ? 0.65 : 1;
  return { ready: 850 * f, shoot: Math.max(260, 620 * f), result: 1250 * f };
}

function keeperName(t: TeamSheet): string {
  return t.players.find((p) => toPosition(p.pos) === 'GOL')?.name ?? 'Goleiro';
}

/** Luva do goleiro (vista da palma). */
function Glove({ color, stripe, mirror = false }: { color: string; stripe: string; mirror?: boolean }) {
  const ink = '#14161c';
  const palm = '#eef2f7';
  return (
    <svg className="pk-glove" viewBox="0 0 64 80" aria-hidden="true" style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      <rect x="2" y="32" width="11" height="24" rx="5.5" fill={palm} stroke={ink} strokeWidth="2.2" transform="rotate(-32 7 44)" />
      <rect x="13" y="12" width="9" height="30" rx="4.5" fill={palm} stroke={ink} strokeWidth="2.2" />
      <rect x="22.5" y="7" width="9" height="34" rx="4.5" fill={palm} stroke={ink} strokeWidth="2.2" />
      <rect x="32" y="8" width="9" height="33" rx="4.5" fill={palm} stroke={ink} strokeWidth="2.2" />
      <rect x="41.5" y="13" width="8.5" height="28" rx="4.25" fill={palm} stroke={ink} strokeWidth="2.2" />
      <rect x="12" y="28" width="40" height="31" rx="10" fill={palm} stroke={ink} strokeWidth="2.2" />
      <path d="M14 40 H50 V47 H14 Z" fill={color} opacity="0.9" />
      <path d="M18 33 Q32 30 46 33" fill="none" stroke="#c9d1dc" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="13" y="56" width="38" height="19" rx="4" fill={color} stroke={ink} strokeWidth="2.2" />
      <rect x="13" y="62" width="38" height="4.5" fill={stripe} />
    </svg>
  );
}

/** Bola (desenho próprio, simples). */
function Ball() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#14161c" strokeWidth="2" />
      <path d="M20 13 L26.5 17.6 L24 25 H16 L13.5 17.6 Z" fill="#14161c" />
      <path d="M20 13 V4.5 M26.5 17.6 L34 15 M24 25 L28.5 32 M16 25 L11.5 32 M13.5 17.6 L6 15" stroke="#14161c" strokeWidth="1.6" />
      <path d="M8 6.5 Q11 3.5 15 3 L13 8 Z M32 6.5 Q29 3.5 25 3 L27 8 Z M2.6 22 Q2.4 26 4.6 29.5 L8 26 Z M37.4 22 Q37.6 26 35.4 29.5 L32 26 Z M17 37.4 Q20 38 23 37.4 L22 33.6 H18 Z" fill="#14161c" />
      <ellipse cx="14" cy="11" rx="5" ry="3" fill="#ffffff" opacity="0.55" transform="rotate(-30 14 11)" />
    </svg>
  );
}

interface Props {
  kicks: ShootoutKick[];
  score: [number, number];
  home: TeamSheet;
  away: TeamSheet;
  /** Semente para a encenação (cantos e mergulhos). */
  seed: number;
  /** Velocidade escolhida na partida (1, 2 ou 4). */
  speed: number;
  /** Lado do jogador na disputa (para a comemoração). */
  userSide: Side;
  onDone: () => void;
}

export function PenaltyShootout({ kicks, score, home, away, seed, speed, userSide, onDone }: Props) {
  const plans = useMemo(() => kicks.map((k, i) => planKick(k, i, seed)), [kicks, seed]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const finished = idx >= kicks.length;
  const notified = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (finished) {
      if (!notified.current) {
        notified.current = true;
        onDoneRef.current();
      }
      return;
    }
    const t = timings(speed);
    const id = setTimeout(
      () => {
        if (phase === 'ready') setPhase('shoot');
        else if (phase === 'shoot') setPhase('result');
        else {
          setPhase('ready');
          setIdx((n) => n + 1);
        }
      },
      phase === 'ready' ? t.ready : phase === 'shoot' ? t.shoot : t.result,
    );
    return () => clearTimeout(id);
  }, [idx, phase, speed, finished]);

  const shown = finished ? kicks.length : idx + (phase === 'result' ? 1 : 0);
  const done = kicks.slice(0, shown);
  const live: [number, number] = [done.filter((k) => k.side === 'home' && k.scored).length, done.filter((k) => k.side === 'away' && k.scored).length];
  const team = (side: Side) => (side === 'home' ? home : away);

  const kick = finished ? null : kicks[idx];
  const plan = finished ? null : plans[idx];
  const t = timings(speed);
  const moving = phase !== 'ready';
  const ballPos = !plan || !moving ? REST_BALL : phase === 'shoot' ? plan.ball : plan.after;
  const keeperPos = !plan || !moving ? REST_KEEPER : plan.keeper;
  const defending = kick ? team(kick.side === 'home' ? 'away' : 'home') : home;

  const winner: Side = score[0] > score[1] ? 'home' : 'away';
  const userWon = finished && winner === userSide;
  const suddenDeath = idx >= 10 && !finished;

  const row = (side: Side) => {
    const list = kicks.map((k, i) => ({ k, i })).filter(({ k }) => k.side === side);
    const slots = Math.max(5, list.filter(({ i }) => i < Math.max(shown, idx + 1)).length);
    return (
      <div className="pk-row">
        <span className="pk-team">
          <TeamCrest team={team(side)} size={18} /> {team(side).short}
        </span>
        <span className="pk-marks">
          {Array.from({ length: slots }, (_, n) => {
            const item = list[n];
            const state = !item ? 'empty' : item.i < shown ? (item.k.scored ? 'in' : 'out') : item.i === idx && !finished ? 'now' : 'empty';
            return (
              <span key={n} className={`pk-mark is-${state}`} aria-hidden="true">
                {state === 'in' ? '✓' : state === 'out' ? '✕' : ''}
              </span>
            );
          })}
        </span>
        <span className="pk-total">{live[side === 'home' ? 0 : 1]}</span>
      </div>
    );
  };

  const stageStyle = {
    '--t': `${phase === 'shoot' ? t.shoot : Math.min(520, t.result * 0.45)}ms`,
    '--bx': `${ballPos.x}%`,
    '--by': `${ballPos.y}%`,
    '--bs': ballPos.s,
    '--bo': plan && phase === 'result' ? plan.after.o : 1,
    '--br': moving ? '600deg' : '0deg',
    '--kx': `${keeperPos.x}%`,
    '--ky': `${keeperPos.y}%`,
    '--kr': `${keeperPos.r}deg`,
    '--kt': `${t.shoot}ms`,
  } as CSSProperties;

  return (
    <div className="pk" aria-label="Disputa de pênaltis">
      <div className="pk-head">
        <span className="pk-title">Disputa de pênaltis</span>
        <span className="chip">{finished ? 'Encerrada' : suddenDeath ? 'Cobranças alternadas' : `Cobrança ${Math.floor(idx / 2) + 1} de 5`}</span>
      </div>

      <div className="pk-board">
        {row('home')}
        {row('away')}
      </div>

      <div className={`pk-stage ${finished ? 'is-finished' : ''}`} style={stageStyle}>
        <div className="pk-sky" />
        <div className="pk-grass" />
        <div className="pk-goal">
          <div className={`pk-net ${plan && phase === 'result' && plan.outcome === 'goal' ? 'is-hit' : ''}`} key={`net-${idx}`} />
          <div className="pk-frame" />
        </div>
        <div className="pk-line" />
        <div className="pk-spot" />
        {plan && phase === 'result' && plan.outcome === 'goal' && <span className="pk-burst" style={{ left: `${plan.ball.x}%`, top: `${plan.ball.y}%` }} key={`burst-${idx}`} />}
        {plan && phase === 'result' && plan.outcome === 'post' && <span className="pk-spark" style={{ left: `${plan.ball.x}%`, top: `${plan.ball.y}%` }} key={`spark-${idx}`} />}

        {!finished && (
          <div className={`pk-keeper ${phase === 'ready' ? 'is-idle' : ''}`} key={`keeper-${idx}`}>
            <Glove color={defending.colors.primary} stripe={defending.colors.secondary} mirror />
            <Glove color={defending.colors.primary} stripe={defending.colors.secondary} />
          </div>
        )}
        {!finished && (
          <div className="pk-ball" key={`ball-${idx}`}>
            <Ball />
          </div>
        )}

        {plan && phase === 'result' && (
          <div className={`pk-call is-${plan.outcome}`} key={`call-${idx}`} role="status">
            {CALL[plan.outcome]}
          </div>
        )}

        {kick && (
          <div className="pk-taker">
            <span className="pk-taker-who">
              <TeamCrest team={team(kick.side)} size={16} /> {kick.name}
            </span>
            <span className="pk-taker-vs">no gol: {keeperName(defending)}</span>
          </div>
        )}

        {finished && (
          <div className="pk-final" role="status">
            {userWon && <Confetti count={70} />}
            <TeamCrest team={team(winner)} size={46} />
            <strong>{team(winner).name}</strong>
            <span>
              vence por {Math.max(score[0], score[1])} a {Math.min(score[0], score[1])} nos pênaltis!
            </span>
          </div>
        )}
      </div>

      <div className="pk-actions">
        {!finished ? (
          <button className="btn btn-ghost btn-sm pk-skip" onClick={() => setIdx(kicks.length)}>
            Pular pênaltis ⏭
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPhase('ready');
              setIdx(0);
            }}
          >
            ↺ Ver de novo
          </button>
        )}
      </div>
    </div>
  );
}
