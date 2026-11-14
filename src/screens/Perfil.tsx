import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../cloud/auth';
import { cloudEnabled } from '../cloud/config';
import { isNameAvailable, updateDisplayName } from '../cloud/session';
import { NameTakenError } from '../cloud/repo';
import { useProfileAvatar } from '../cloud/profile';
import { ACHIEVEMENT_DEFS } from '../history/achievements';
import { careerStats } from '../history/records';
import { useHistory } from '../history/store';
import { AccountBanner, GoogleButton, ProfileAvatar, SignOutButton, StaffBadge, SyncIndicator } from '../components/Account';
import { AvatarPicker } from '../components/AvatarPicker';
import { useToast } from '../components/ui';
import { fmtDate, SeasonCard } from '../components/SeasonViews';

const NAME_MIN = 3;
const NAME_MAX = 30;

type NameState = 'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'unknown';

function cleanName(n: string): string {
  return n.trim().replace(/\s+/g, ' ');
}

/** Mesma regra do banco: ignora maiúsculas, acentos e espaços repetidos. */
function nameKey(n: string): string {
  return cleanName(n).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

function nameProblem(n: string): string | null {
  const c = cleanName(n);
  if (c.length < NAME_MIN) return `Use pelo menos ${NAME_MIN} caracteres.`;
  if (c.length > NAME_MAX) return `Use no máximo ${NAME_MAX} caracteres.`;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(c)) return 'Use só letras, números, espaço, ponto, hífen ou apóstrofo.';
  return null;
}

function Stat({ v, k }: { v: string | number; k: string }) {
  return (
    <div className="profile-stat">
      <b>{v}</b>
      <span>{k}</span>
    </div>
  );
}

export function Perfil() {
  const { status, user } = useAuth();
  const data = useHistory((s) => s.data);
  const career = useMemo(() => careerStats(data.seasons, data.titles), [data]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [toast, showToast] = useToast();
  const chosenAvatar = useProfileAvatar();
  const [nameState, setNameState] = useState<NameState>('idle');
  const [nameError, setNameError] = useState<string | null>(null);

  // confere se o nome está livre enquanto o jogador digita
  const currentName = user?.name ?? '';
  useEffect(() => {
    if (!editing) return;
    setNameError(null);
    const problem = nameProblem(name);
    if (problem) {
      setNameState('invalid');
      return;
    }
    if (sameName(name, currentName)) {
      setNameState('idle');
      return;
    }
    setNameState('checking');
    let alive = true;
    const t = setTimeout(() => {
      void isNameAvailable(cleanName(name)).then((ok) => {
        if (alive) setNameState(ok === null ? 'unknown' : ok ? 'free' : 'taken');
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, editing, currentName]);

  if (status === 'loading') {
    return (
      <div className="page profile-page">
        <div className="profile-skeleton panel" aria-busy="true">
          <span className="sk-avatar" />
          <span className="sk-line" />
          <span className="sk-line short" />
          <p className="dim">Carregando perfil…</p>
        </div>
      </div>
    );
  }

  const signedIn = status === 'signed-in' && user;
  if (cloudEnabled && !signedIn) {
    return (
      <div className="page profile-page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Sua conta</div>
            <h1>Meu Perfil</h1>
          </div>
        </div>
        <div className="login-gate panel">
          <h2>{status === 'expired' ? 'Sua sessão expirou' : 'Entre para ver seu perfil'}</h2>
          <p className="muted">
            Com a conta Google, suas temporadas, títulos, conquistas e o progresso da partida ficam salvos na nuvem e aparecem em qualquer computador ou celular.
          </p>
          <GoogleButton />
          <a className="btn btn-link" href="#inicio">
            Continuar como visitante
          </a>
        </div>
      </div>
    );
  }

  const unlocked = data.unlocks.length;
  const save = async () => {
    const problem = nameProblem(name);
    if (problem) {
      setNameError(problem);
      return;
    }
    if (sameName(name, currentName) && cleanName(name) === currentName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await updateDisplayName(cleanName(name));
      setEditing(false);
      showToast('Nome atualizado!');
    } catch (e) {
      if (e instanceof NameTakenError) {
        setNameState('taken');
        setNameError(e.message);
      } else setNameError('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  };
  const nameHint =
    nameError ??
    (nameState === 'invalid'
      ? nameProblem(name)
      : nameState === 'checking'
        ? 'Verificando se o nome está livre…'
        : nameState === 'free'
          ? '✓ Nome disponível'
          : nameState === 'taken'
            ? '✗ Esse nome já está em uso por outro jogador'
            : null);
  const nameBlocked = saving || nameState === 'taken' || nameState === 'invalid' || nameState === 'checking';

  return (
    <div className="page profile-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sua conta</div>
          <h1>Meu Perfil</h1>
        </div>
        {signedIn && <SyncIndicator />}
      </div>
      {!signedIn && <AccountBanner />}

      <section className="profile-card panel">
        <div className="profile-photo">
          <ProfileAvatar size={96} />
          <button className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>
            Trocar foto
          </button>
        </div>
        <div className="profile-id">
          {signedIn ? (
            editing ? (
              <form
                className="name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div className="row">
                  <input className="search" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-label="Nome de exibição" autoFocus />
                  <button className="btn btn-gold btn-sm" disabled={nameBlocked}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                </div>
                {nameHint && (
                  <p className={`name-hint is-${nameError || nameState === 'taken' || nameState === 'invalid' ? 'bad' : nameState === 'free' ? 'ok' : 'info'}`} role="status">
                    {nameHint}
                  </p>
                )}
              </form>
            ) : (
              <h2>
                {user.name} <StaffBadge />{' '}
                <button
                  className="btn btn-link"
                  onClick={() => {
                    setName(user.name);
                    setEditing(true);
                  }}
                >
                  editar nome
                </button>
              </h2>
            )
          ) : (
            <h2>Visitante</h2>
          )}
          {signedIn && user.email && <p className="muted">{user.email}</p>}
          <p className="dim">{signedIn ? `No 11BRL desde ${fmtDate(user.createdAt)}` : 'Dados salvos só neste aparelho'}</p>
        </div>
        {signedIn && <SignOutButton />}
      </section>

      {!chosenAvatar && (
        <section className="avatar-cta panel">
          <div>
            <strong>Escolha o seu avatar</strong>
            <span className="dim">Sua foto no jogo é um craque do futebol brasileiro: escolha o jogador, o clube e a época.</span>
          </div>
          <button className="btn btn-gold" onClick={() => setPicking(true)}>
            Escolher avatar
          </button>
        </section>
      )}

      <div className="profile-stats">
        <Stat v={career.seasonsPlayed} k="Temporadas disputadas" />
        <Stat v={career.titles} k="Títulos conquistados" />
        <Stat v={career.perfectSeasons} k="Temporadas perfeitas" />
        <Stat v={career.bestOverall?.value ?? '—'} k="Maior overall" />
        <Stat v={`${unlocked}/${ACHIEVEMENT_DEFS.length}`} k="Conquistas" />
      </div>

      {career.bestCampaign && (
        <section className="section">
          <h2 className="section-title">Melhor campanha</h2>
          <SeasonCard season={career.bestCampaign} />
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Estatísticas acumuladas</h2>
        <div className="panel career-grid">
          <Stat v={career.seasonsPlayed} k="Temporadas disputadas" />
          <Stat v={career.seasonsFinished} k="Temporadas finalizadas" />
          <Stat v={career.wins} k="Vitórias" />
          <Stat v={career.draws} k="Empates" />
          <Stat v={career.losses} k="Derrotas" />
          <Stat v={career.goalsFor} k="Gols marcados" />
          <Stat v={career.goalsAgainst} k="Gols sofridos" />
          <Stat v={career.titles} k="Títulos" />
          <Stat v={career.perfectSeasons} k="Temporadas perfeitas" />
          <Stat v={career.bestClub ? career.bestClub.name : '—'} k={career.bestClub ? `Melhor clube · ${career.bestClub.titles} títulos, média ${career.bestClub.avgPoints} pts` : 'Melhor clube'} />
          <Stat
            v={career.bestDecade ? `Anos ${career.bestDecade.decade.slice(2, 4)}` : '—'}
            k={career.bestDecade ? `Melhor década · média ${career.bestDecade.avgPoints} pts` : 'Melhor década'}
          />
          <Stat v={career.bestOverall?.value ?? '—'} k="Melhor overall" />
        </div>
        {!career.seasonsPlayed && <p className="dim" style={{ marginTop: 8 }}>As estatísticas aparecem a partir da sua primeira temporada.</p>}
      </section>

      <nav className="profile-links">
        <a className="btn btn-ghost" href="#historico">
          Meu Histórico
        </a>
        <a className="btn btn-ghost" href="#conquistas">
          Conquistas
        </a>
        <a className="btn btn-ghost" href="#recordes">
          Meus Recordes
        </a>
        <a className="btn btn-gold" href="#hall">
          Hall dos Lendários
        </a>
      </nav>
      {picking && <AvatarPicker onClose={() => setPicking(false)} onSaved={showToast} />}
      {toast}
    </div>
  );
}
