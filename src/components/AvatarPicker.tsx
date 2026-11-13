// Escolha da foto de perfil entre os avatares de todos os jogadores, com
// filtros por clube, por década e busca pelo nome.
import { useMemo, useState } from 'react';
import { CLUB_BY_ID, CLUBS } from '../data/clubs';
import { db } from '../data/db';
import { DECADES, decadeLabel, type Card, type Decade } from '../data/types';
import { setProfileAvatar, useProfileAvatar } from '../cloud/profile';
import { Crest } from './Crest';
import { PlayerFace } from './PlayerFace';
import { Modal } from './ui';
import { useAuth } from '../cloud/auth';
import { isOwnerAvatar, OWNER_AVATAR_KEY, OWNER_AVATAR_LABEL, ownerAvatarUrl } from '../avatars/owner';

const PAGE = 48;

/** Texto para busca: minúsculo e sem acentos. */
export function searchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

let ALL: Card[] | null = null;

/** Todos os avatares disponíveis (uma carta = jogador + clube + década), dos maiores overalls para os menores. */
export function allAvatarCards(): Card[] {
  ALL ??= [...db.cardByKey.values()].sort((a, b) => b.overall - a.overall || a.player.name.localeCompare(b.player.name, 'pt-BR'));
  return ALL;
}

export function filterAvatarCards(cards: Card[], f: { query?: string; club?: string; decade?: Decade | '' }): Card[] {
  const q = searchText((f.query ?? '').trim());
  return cards.filter(
    (c) =>
      (!f.club || c.club === f.club) &&
      (!f.decade || c.decade === f.decade) &&
      (!q || searchText(c.player.name).includes(q) || searchText(c.player.fullName ?? '').includes(q)),
  );
}

const CLUB_OPTIONS = [...CLUBS].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export function AvatarPicker({ onClose, onSaved }: { onClose: () => void; onSaved?: (msg: string) => void }) {
  const current = useProfileAvatar();
  const [selected, setSelected] = useState<string | null>(current);
  const [query, setQuery] = useState('');
  const [club, setClub] = useState('');
  const [decade, setDecade] = useState<Decade | ''>('');
  const [limit, setLimit] = useState(PAGE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => filterAvatarCards(allAvatarCards(), { query, club, decade }), [query, club, decade]);
  const decades = club ? DECADES.filter((d) => CLUB_BY_ID[club]?.decades.includes(d)) : DECADES;
  const chosen = db.cardMaybe(selected);
  const title = useAuth((st) => (st.status === 'signed-in' ? (st.user?.title ?? null) : null));
  const ownerSelected = !!title && isOwnerAvatar(selected);
  const filtered = Boolean(query || club || decade);

  const update = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };

  const save = async (key: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await setProfileAvatar(key);
      onSaved?.(key ? 'Foto de perfil atualizada!' : 'Foto de perfil removida.');
      onClose();
    } catch {
      setError('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal label="Escolher foto de perfil" onClose={onClose} className="modal-wide avatar-picker">
      <div className="picker-head">
        <div>
          <div className="eyebrow">Foto de perfil</div>
          <h2>Escolha seu avatar</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="picker-preview panel">
        {ownerSelected ? (
          <img className="pavatar" src={ownerAvatarUrl()} width={84} height={84} alt={OWNER_AVATAR_LABEL} />
        ) : chosen ? (
          <PlayerFace card={chosen} size={84} />
        ) : (
          <span className="user-avatar visitor" style={{ width: 84, height: 84, fontSize: 28 }}>
            ?
          </span>
        )}
        <div className="grow">
          {ownerSelected ? (
            <>
              <strong className="picker-preview-name">{OWNER_AVATAR_LABEL}</strong>
              <span className="muted">Avatar exclusivo do fundador do jogo</span>
            </>
          ) : chosen ? (
            <>
              <strong className="picker-preview-name">{chosen.player.name}</strong>
              <span className="muted">
                {CLUB_BY_ID[chosen.club].name} · {decadeLabel(chosen.decade)}
              </span>
            </>
          ) : (
            <span className="muted">Nenhum avatar escolhido. Toque em um jogador abaixo.</span>
          )}
          {error && <span className="picker-error">{error}</span>}
        </div>
        <div className="row wrap picker-actions">
          <button className="btn btn-gold" disabled={saving || !selected || selected === current} onClick={() => void save(selected)}>
            {saving ? 'Salvando…' : 'Usar este avatar'}
          </button>
          {current && (
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void save(null)}>
              Remover foto
            </button>
          )}
        </div>
      </div>

      <div className="picker-filters">
        <input
          className="search"
          type="search"
          value={query}
          placeholder="Buscar jogador pelo nome"
          aria-label="Buscar jogador pelo nome"
          onChange={(e) => update(() => setQuery(e.target.value))}
        />
        <select
          className="select"
          value={club}
          aria-label="Filtrar por clube"
          onChange={(e) =>
            update(() => {
              const next = e.target.value;
              setClub(next);
              if (next && decade && !CLUB_BY_ID[next]?.decades.includes(decade)) setDecade('');
            })
          }
        >
          <option value="">Todos os clubes</option>
          {CLUB_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={decade} aria-label="Filtrar por década" onChange={(e) => update(() => setDecade(e.target.value as Decade | ''))}>
          <option value="">Todas as décadas</option>
          {decades.map((d) => (
            <option key={d} value={d}>
              {decadeLabel(d)}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="btn btn-link"
            onClick={() =>
              update(() => {
                setQuery('');
                setClub('');
                setDecade('');
              })
            }
          >
            Limpar filtros
          </button>
        )}
      </div>
      <p className="dim picker-count" aria-live="polite">
        {results.length === 0 ? 'Nenhum jogador encontrado com esses filtros.' : `${results.length.toLocaleString('pt-BR')} ${results.length === 1 ? 'avatar' : 'avatares'}`}
      </p>

      {title && (
        <div className="picker-exclusive">
          <span className="eyebrow">Exclusivo do {title.toLowerCase()}</span>
          <button className={`picker-item is-exclusive ${ownerSelected ? 'is-selected' : ''}`} onClick={() => setSelected(OWNER_AVATAR_KEY)} aria-pressed={ownerSelected} title="Avatar exclusivo do fundador">
            <img className="pavatar" src={ownerAvatarUrl()} width={72} height={72} alt="" />
            <span className="picker-name">{OWNER_AVATAR_LABEL}</span>
            <span className="picker-meta">Só na sua conta</span>
          </button>
        </div>
      )}
      <div className="picker-grid">
        {results.slice(0, limit).map((c) => {
          const cl = CLUB_BY_ID[c.club];
          const isSel = selected === c.key;
          return (
            <button key={c.key} className={`picker-item ${isSel ? 'is-selected' : ''}`} onClick={() => setSelected(c.key)} aria-pressed={isSel} title={`${c.player.name} · ${cl.name} · ${decadeLabel(c.decade)}`}>
              <PlayerFace card={c} size={72} />
              <span className="picker-name">{c.player.name}</span>
              <span className="picker-meta">
                <Crest club={cl} size={11} /> {cl.short} · {c.decade.slice(2, 4)}
              </span>
            </button>
          );
        })}
      </div>
      {results.length > limit && (
        <div className="picker-more">
          <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Mostrar mais ({(results.length - limit).toLocaleString('pt-BR')} restantes)
          </button>
        </div>
      )}
    </Modal>
  );
}
