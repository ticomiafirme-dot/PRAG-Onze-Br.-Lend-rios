// Comemoração de conquistas, títulos e recordes: aparece sobre qualquer tela
// assim que algo é desbloqueado, uma notificação por vez.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACHIEVEMENT_BY_ID, TIER_LABEL } from '../history/achievements';
import { COMPETITION_BY_ID } from '../history/competitions';
import { useHistory, type Notice } from '../history/store';
import { usePlayerName, usePlayerRole } from '../cloud/profile';
import { navigate } from '../router';
import { ShareModal } from '../share/ShareModal';
import { achievementFilename, renderAchievementCard } from '../share/achievementCard';
import { Confetti } from './ui';
import { Medal } from './Medal';
import { Trophy } from './Trophy';

export function UnlockOverlay() {
  const notices = useHistory((s) => s.notices);
  const dismiss = useHistory((s) => s.dismissNotice);
  const notice = notices[0];
  if (!notice) return null;
  return createPortal(<NoticeView key={notice.id} notice={notice} onClose={() => dismiss(notice.id)} remaining={notices.length - 1} />, document.body);
}

function NoticeView({ notice, onClose, remaining }: { notice: Notice; onClose: () => void; remaining: number }) {
  const [sharing, setSharing] = useState(false);
  const seasons = useHistory((s) => s.data.seasons);
  const playerName = usePlayerName();
  const playerRole = usePlayerRole();

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && !sharing && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose, sharing]);

  const next = remaining > 0 ? `Continuar (${remaining} ${remaining === 1 ? 'nova' : 'novas'})` : 'Continuar';

  if (notice.kind === 'achievement') {
    const u = notice.unlock;
    const def = ACHIEVEMENT_BY_ID[u.id];
    const season = seasons.find((s) => s.runId === u.runId) ?? null;
    const special = u.tier === 'ouro' || u.tier === 'lendaria';
    return (
      <div className={`unlock-overlay tier-${u.tier}`} role="dialog" aria-modal="true" aria-label={`Conquista desbloqueada: ${u.name}`}>
        {special && <Confetti count={u.tier === 'lendaria' ? 170 : 120} />}
        <div className="unlock-rays" aria-hidden="true" />
        <div className="unlock-card">
          <div className="unlock-eyebrow">Conquista desbloqueada!</div>
          <div className="unlock-medal">
            <Medal tier={u.tier} icon={def?.icon ?? 'medal'} size={150} />
          </div>
          <div className={`tier-pill tier-${u.tier}`}>
            {TIER_LABEL[u.tier]}
            {def?.reward ? ` · ${def.reward}` : ''}
          </div>
          <h2 className="unlock-name">{u.name}</h2>
          <p className="unlock-message">{def ? def.message({ value: u.value, detail: u.detail }) : ''}</p>
          {def && <p className="unlock-objective dim">{def.objective}</p>}
          <div className="unlock-actions">
            <button className="btn btn-gold" onClick={() => setSharing(true)}>
              Compartilhar conquista
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              {next}
            </button>
          </div>
        </div>
        {sharing && (
          <ShareModal
            title={`Conquista: ${u.name}`}
            filename={achievementFilename(u)}
            text={`Desbloqueei a conquista "${u.name}" no PRAG Onze BR Lendário!`}
            render={() => renderAchievementCard({ unlock: u, season, playerName, playerRole })}
            onClose={() => setSharing(false)}
          />
        )}
      </div>
    );
  }

  if (notice.kind === 'title') {
    const t = notice.title;
    const comp = COMPETITION_BY_ID[t.competitionId];
    return (
      <div className="unlock-overlay tier-ouro" role="dialog" aria-modal="true" aria-label={`Título conquistado: ${t.competitionName}`}>
        <Confetti count={110} />
        <div className="unlock-rays" aria-hidden="true" />
        <div className="unlock-card">
          <div className="unlock-eyebrow">Título conquistado!</div>
          <div className="unlock-medal">
            <Trophy style={comp?.trophy ?? 'estadual'} label={comp?.state} size={130} />
          </div>
          <h2 className="unlock-name">{t.competitionName}</h2>
          <p className="unlock-message">{t.teamName} é campeão! O troféu já está no seu Hall dos Lendários.</p>
          <div className="unlock-actions">
            <button className="btn btn-gold" onClick={onClose}>
              {next}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="unlock-overlay tier-prata" role="dialog" aria-modal="true" aria-label="Novo recorde pessoal">
      <div className="unlock-rays" aria-hidden="true" />
      <div className="unlock-card">
        <div className="unlock-eyebrow">{notice.records.length > 1 ? 'Novos recordes pessoais!' : 'Novo recorde pessoal!'}</div>
        <ul className="unlock-records">
          {notice.records.map((r) => (
            <li key={r.id}>
              <span className="dim">{r.label}</span>
              <strong>
                {r.value}
                {r.detail ? <span className="dim"> · {r.detail}</span> : null}
              </strong>
            </li>
          ))}
        </ul>
        <div className="unlock-actions">
          <button
            className="btn btn-blue"
            onClick={() => {
              onClose();
              navigate('/recordes');
            }}
          >
            Ver meus recordes
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            {next}
          </button>
        </div>
      </div>
    </div>
  );
}
