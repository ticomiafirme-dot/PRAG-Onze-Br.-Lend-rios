import { useMemo, useState } from 'react';
import { ACHIEVEMENT_DEFS, TIER_LABEL, TIER_ORDER, type AchievementTier } from '../history/achievements';
import { decadesLabel } from '../history/record';
import { useHistory } from '../history/store';
import type { UnlockRecord } from '../history/types';
import { usePlayerName, usePlayerRole } from '../cloud/profile';
import { Medal } from '../components/Medal';
import { fmtDate } from '../components/SeasonViews';
import { AccountBanner } from '../components/Account';
import { ShareModal } from '../share/ShareModal';
import { achievementFilename, renderAchievementCard } from '../share/achievementCard';
import type { IconName } from '../components/icons';

interface Row {
  id: string;
  name: string;
  objective: string;
  icon: IconName;
  tier: AchievementTier;
  reward?: string;
  unlock: UnlockRecord | null;
  progress: { current: number; target: number; text: string } | null;
}

export function Conquistas() {
  const data = useHistory((s) => s.data);
  const playerName = usePlayerName();
  const playerRole = usePlayerRole();
  const [sharing, setSharing] = useState<UnlockRecord | null>(null);
  const [filter, setFilter] = useState<'todas' | 'desbloqueadas' | 'bloqueadas'>('todas');

  const rows: Row[] = useMemo(() => {
    const finished = data.seasons.filter((s) => s.status === 'finished');
    const byId = new Map(data.unlocks.map((u) => [u.id, u]));
    const list: Row[] = ACHIEVEMENT_DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      objective: d.objective,
      icon: d.icon,
      tier: d.tier,
      reward: d.reward,
      unlock: byId.get(d.id) ?? null,
      progress: byId.has(d.id) ? null : (d.progress?.({ finished, titles: data.titles }) ?? null),
    }));
    // conquistas antigas que não existem mais no catálogo continuam registradas
    for (const u of data.unlocks) {
      if (!ACHIEVEMENT_DEFS.some((d) => d.id === u.id)) list.push({ id: u.id, name: u.name, objective: 'Conquista de uma versão anterior do jogo.', icon: 'medal', tier: u.tier, unlock: u, progress: null });
    }
    return list;
  }, [data]);

  const unlocked = rows.filter((r) => r.unlock).length;
  const shown = rows.filter((r) => (filter === 'todas' ? true : filter === 'desbloqueadas' ? !!r.unlock : !r.unlock));
  const sharingSeason = sharing ? (data.seasons.find((s) => s.runId === sharing.runId) ?? null) : null;

  return (
    <div className="page ach-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sua coleção</div>
          <h1>Conquistas</h1>
          <p className="muted">
            {unlocked} de {rows.length} desbloqueadas. Verificadas automaticamente ao completar o elenco, a cada partida, título e fim de temporada.
          </p>
        </div>
      </div>
      <AccountBanner />
      <div className="ach-summary panel">
        <div className="meter ach-meter" role="meter" aria-valuenow={unlocked} aria-valuemin={0} aria-valuemax={rows.length}>
          <span style={{ width: `${(100 * unlocked) / Math.max(1, rows.length)}%` }} />
        </div>
        <div className="ach-tiers">
          {TIER_ORDER.map((t) => {
            const all = rows.filter((r) => r.tier === t);
            return (
              <span key={t} className={`tier-pill tier-${t}`}>
                {TIER_LABEL[t]} {all.filter((r) => r.unlock).length}/{all.length}
              </span>
            );
          })}
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Filtrar conquistas" style={{ margin: '14px 0' }}>
        {(['todas', 'desbloqueadas', 'bloqueadas'] as const).map((f) => (
          <button key={f} role="tab" className="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
            {f === 'todas' ? 'Todas' : f === 'desbloqueadas' ? 'Desbloqueadas' : 'Bloqueadas'}
          </button>
        ))}
      </div>
      <div className="ach-grid">
        {shown.map((r) => {
          const season = r.unlock ? data.seasons.find((s) => s.runId === r.unlock!.runId) : null;
          return (
            <article key={r.id} className={`ach-card tier-${r.tier} ${r.unlock ? 'is-unlocked' : 'is-locked'}`}>
              <div className="ach-medal">
                <Medal tier={r.tier} icon={r.icon} size={74} locked={!r.unlock} />
              </div>
              <div className="ach-body">
                <div className="ach-top">
                  <h3>{r.name}</h3>
                  <span className={`tier-pill tier-${r.tier}`}>{TIER_LABEL[r.tier]}</span>
                </div>
                <p className="ach-objective">{r.objective}</p>
                {r.reward && <p className="ach-reward">Recompensa: {r.reward}</p>}
                {r.unlock ? (
                  <>
                    <p className="ach-when">
                      Desbloqueada em <strong>{fmtDate(r.unlock.unlockedAt)}</strong>
                      {r.unlock.detail ? ` · ${r.unlock.detail}` : ''}
                    </p>
                    {season && (
                      <a className="ach-season" href={`#temporada-${season.runId}`}>
                        {season.teamName}
                        {decadesLabel(season) ? ` · ${decadesLabel(season)}` : ''} · {season.formationId}
                      </a>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setSharing(r.unlock)}>
                      Compartilhar
                    </button>
                  </>
                ) : (
                  r.progress && (
                    <div className="ach-progress">
                      <div className="meter">
                        <span style={{ width: `${Math.min(100, (100 * r.progress.current) / Math.max(1, r.progress.target))}%` }} />
                      </div>
                      <p className="dim">{r.progress.text}</p>
                    </div>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
      {sharing && (
        <ShareModal
          title={`Conquista: ${sharing.name}`}
          filename={achievementFilename(sharing)}
          text={`Desbloqueei a conquista "${sharing.name}" no PRAG Onze BR Lendário!`}
          render={() => renderAchievementCard({ unlock: sharing, season: sharingSeason, playerName, playerRole })}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
