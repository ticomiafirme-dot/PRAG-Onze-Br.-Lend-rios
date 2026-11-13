import { useMemo, useState } from 'react';
import { useAuth } from '../cloud/auth';
import { cloudEnabled } from '../cloud/config';
import { updateDisplayName } from '../cloud/session';
import { ACHIEVEMENT_DEFS } from '../history/achievements';
import { careerStats } from '../history/records';
import { useHistory } from '../history/store';
import { AccountBanner, GoogleButton, ProfileAvatar, SignOutButton, SyncIndicator } from '../components/Account';
import { AvatarPicker } from '../components/AvatarPicker';
import { useToast } from '../components/ui';
import { fmtDate, SeasonCard } from '../components/SeasonViews';

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
    setSaving(true);
    try {
      await updateDisplayName(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

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
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <input className="search" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Nome de exibição" autoFocus />
                <button className="btn btn-gold btn-sm" disabled={saving || !name.trim()}>
                  Salvar
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <h2>
                {user.name}{' '}
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
          <p className="dim">{signedIn ? `No PRAG desde ${fmtDate(user.createdAt)}` : 'Dados salvos só neste aparelho'}</p>
        </div>
        {signedIn && <SignOutButton />}
      </section>

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
