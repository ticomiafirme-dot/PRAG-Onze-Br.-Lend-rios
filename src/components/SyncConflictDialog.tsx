// Quando este aparelho e a nuvem têm partidas diferentes em andamento, o
// jogador escolhe qual continuar (nada é descartado sem a escolha dele).
import { useEffect, useState } from 'react';
import { setConflictResolver, type ConflictChoice } from '../cloud/sync';
import { fmtDate } from './SeasonViews';
import { Modal } from './ui';

export function SyncConflictDialog() {
  const [pending, setPending] = useState<{ c: ConflictChoice; resolve: (v: 'local' | 'cloud') => void } | null>(null);
  useEffect(() => {
    setConflictResolver((c) => new Promise((resolve) => setPending({ c, resolve })));
  }, []);
  if (!pending) return null;
  const choose = (v: 'local' | 'cloud') => {
    pending.resolve(v);
    setPending(null);
  };
  const { c } = pending;
  return (
    <Modal label="Escolha qual progresso continuar" onClose={() => undefined}>
      <h3 style={{ fontSize: 24, marginBottom: 6 }}>Qual partida você quer continuar?</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Encontramos uma partida em andamento na sua conta e outra neste aparelho. Escolha uma para continuar. Temporadas já finalizadas continuam no seu histórico de qualquer forma.
      </p>
      <div className="conflict-options">
        <button className="conflict-option" onClick={() => choose('cloud')}>
          <span className="eyebrow">Na nuvem</span>
          <strong>{c.cloud.summary}</strong>
          <span className="dim">
            Salva em {fmtDate(c.cloud.updatedAt)}
            {c.cloud.device ? ` · ${c.cloud.device}` : ''}
          </span>
        </button>
        <button className="conflict-option" onClick={() => choose('local')}>
          <span className="eyebrow">Neste aparelho</span>
          <strong>{c.local.summary}</strong>
          <span className="dim">Progresso deste navegador</span>
        </button>
      </div>
    </Modal>
  );
}
