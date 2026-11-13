// Janela de compartilhamento: prévia da arte e as três ações principais
// (baixar, copiar, compartilhar), com alternativas quando o navegador não ajuda.
// Pode oferecer mais de uma arte (ex.: Resultado e Escalação), em abas.
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/ui';
import { canCopyImage, canShareFiles, canvasToPng, copyImage, saveBlob, shareImage } from './export';

export interface ShareVariant {
  id: string;
  /** Rótulo da aba. */
  label: string;
  title: string;
  filename: string;
  /** Gera a arte (canvas 1080 × 1350). */
  render: () => Promise<HTMLCanvasElement>;
  /** Texto que acompanha o compartilhamento (e a opção secundária de copiar texto). */
  text: string;
}

type SingleProps = Omit<ShareVariant, 'id' | 'label'>;

type Props = (SingleProps | { variants: ShareVariant[]; initial?: string }) & { onClose: () => void };

type Status = { kind: 'ok' | 'info' | 'error'; msg: string } | null;

interface Art {
  blob: Blob | null;
  url: string | null;
  error: string | null;
}

export function ShareModal(props: Props) {
  const variants: ShareVariant[] = 'variants' in props ? props.variants : [{ id: 'arte', label: '', title: props.title, filename: props.filename, render: props.render, text: props.text }];
  const [active, setActive] = useState(('variants' in props && props.initial) || variants[0]?.id || '');
  const [arts, setArts] = useState<Record<string, Art>>({});
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const variantsRef = useRef(variants);
  variantsRef.current = variants;
  const urls = useRef<string[]>([]);

  const current: ShareVariant | undefined = variants.find((v) => v.id === active) ?? variants[0];
  const art = current ? arts[current.id] : undefined;
  const blob = art?.blob ?? null;
  const url = art?.url ?? null;
  const error = art?.error ?? null;

  const pending = useRef(new Set<string>());
  const mounted = useRef(true);

  // gera cada arte uma vez, na primeira vez que a aba é aberta
  useEffect(() => {
    if (arts[active] || pending.current.has(active)) return;
    const v = variantsRef.current.find((x) => x.id === active);
    if (!v) return;
    pending.current.add(v.id);
    v.render()
      .then(canvasToPng)
      .then((b) => {
        if (!mounted.current) return;
        const objectUrl = URL.createObjectURL(b);
        urls.current.push(objectUrl);
        setArts((a) => ({ ...a, [v.id]: { blob: b, url: objectUrl, error: null } }));
      })
      .catch((e: unknown) => {
        if (mounted.current) setArts((a) => ({ ...a, [v.id]: { blob: null, url: null, error: (e as Error).message || 'Não foi possível gerar a arte.' } }));
      })
      .finally(() => pending.current.delete(v.id));
  }, [active, arts]);

  useEffect(() => {
    mounted.current = true;
    const list = urls.current;
    return () => {
      mounted.current = false;
      list.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const select = (id: string) => {
    setActive(id);
    setStatus(null);
  };

  if (!current) return null;

  const download = async () => {
    if (!blob) return;
    setBusy(true);
    const r = await saveBlob(blob, current.filename);
    setBusy(false);
    setStatus(
      r === 'saved'
        ? { kind: 'ok', msg: `Arte baixada: ${current.filename}` }
        : r === 'declined'
          ? { kind: 'info', msg: 'Download cancelado.' }
          : { kind: 'error', msg: 'Não foi possível baixar a arte neste navegador.' },
    );
  };

  const copy = async () => {
    if (!blob) return;
    if (await copyImage(blob)) {
      setStatus({ kind: 'ok', msg: 'Imagem copiada! Cole na conversa ou na rede social.' });
      return;
    }
    // sem suporte a copiar imagens: baixa a arte
    const r = await saveBlob(blob, current.filename);
    setStatus(
      r === 'saved'
        ? { kind: 'info', msg: 'Seu navegador não permite copiar imagens, então baixamos a arte para você.' }
        : { kind: 'error', msg: 'Seu navegador não permite copiar imagens. Use “Baixar arte”.' },
    );
  };

  const share = async () => {
    if (!blob) return;
    const r = await shareImage(blob, current.filename, current.text);
    if (r === 'shared') setStatus({ kind: 'ok', msg: 'Arte compartilhada!' });
    else if (r === 'cancelled') setStatus(null);
    else
      setStatus({
        kind: 'info',
        msg: 'Este navegador não compartilha imagens diretamente. Baixe a arte ou copie a imagem e cole no aplicativo que preferir.',
      });
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(current.text);
      setStatus({ kind: 'ok', msg: 'Resumo em texto copiado.' });
    } catch {
      setStatus({ kind: 'error', msg: 'Não foi possível copiar o texto.' });
    }
  };

  const shareSupported = blob ? canShareFiles(blob, current.filename) : true;

  return (
    <Modal label={current.title} onClose={props.onClose}>
      <div className="share-modal">
        <h3 className="share-title">{current.title}</h3>
        {variants.length > 1 && (
          <div className="share-tabs" role="tablist" aria-label="Escolha a arte">
            {variants.map((v) => (
              <button key={v.id} role="tab" aria-selected={v.id === current.id} className={`share-tab ${v.id === current.id ? 'is-active' : ''}`} onClick={() => select(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        <div className="share-preview" aria-busy={!url}>
          {url ? (
            <img src={url} alt={`Prévia da arte: ${current.title}`} width={1080} height={1350} />
          ) : error ? (
            <p className="share-error">{error}</p>
          ) : (
            <div className="share-loading">Gerando arte…</div>
          )}
        </div>
        <div className="share-actions">
          <button className="btn btn-gold" onClick={download} disabled={!blob || busy}>
            Baixar arte
          </button>
          <button className="btn btn-blue" onClick={copy} disabled={!blob}>
            Copiar imagem
          </button>
          <button className="btn btn-ghost" onClick={share} disabled={!blob}>
            Compartilhar imagem
          </button>
        </div>
        {status && (
          <p className={`share-status is-${status.kind}`} role="status">
            {status.msg}
          </p>
        )}
        {!status && blob && (!shareSupported || !canCopyImage()) && (
          <p className="share-hint dim">
            {!shareSupported && 'O compartilhamento direto não está disponível neste navegador. '}
            {!canCopyImage() && 'Copiar imagens também não; use “Baixar arte”.'}
          </p>
        )}
        <div className="share-foot">
          <button className="btn btn-link btn-sm" onClick={copyText}>
            Copiar resumo em texto
          </button>
          <span className="dim">PNG 1080 × 1350</span>
        </div>
      </div>
    </Modal>
  );
}
