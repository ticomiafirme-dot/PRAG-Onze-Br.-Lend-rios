// Janela de compartilhamento: prévia da arte e as três ações principais
// (baixar, copiar, compartilhar), com alternativas quando o navegador não ajuda.
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/ui';
import { canCopyImage, canShareFiles, canvasToPng, copyImage, saveBlob, shareImage } from './export';

interface Props {
  title: string;
  filename: string;
  /** Gera a arte (canvas 1080 × 1350). */
  render: () => Promise<HTMLCanvasElement>;
  /** Texto que acompanha o compartilhamento (e a opção secundária de copiar texto). */
  text: string;
  onClose: () => void;
}

type Status = { kind: 'ok' | 'info' | 'error'; msg: string } | null;

export function ShareModal({ title, filename, render, text, onClose }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const renderRef = useRef(render);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    renderRef
      .current()
      .then(canvasToPng)
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((e: unknown) => alive && setError((e as Error).message || 'Não foi possível gerar a arte.'));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const download = async () => {
    if (!blob) return;
    setBusy(true);
    const r = await saveBlob(blob, filename);
    setBusy(false);
    setStatus(r === 'saved' ? { kind: 'ok', msg: `Arte baixada: ${filename}` } : r === 'declined' ? { kind: 'info', msg: 'Download cancelado.' } : { kind: 'error', msg: 'Não foi possível baixar a arte neste navegador.' });
  };

  const copy = async () => {
    if (!blob) return;
    if (await copyImage(blob)) {
      setStatus({ kind: 'ok', msg: 'Imagem copiada! Cole na conversa ou na rede social.' });
      return;
    }
    // sem suporte a copiar imagens: baixa a arte
    const r = await saveBlob(blob, filename);
    setStatus(
      r === 'saved'
        ? { kind: 'info', msg: 'Seu navegador não permite copiar imagens, então baixamos a arte para você.' }
        : { kind: 'error', msg: 'Seu navegador não permite copiar imagens. Use “Baixar arte”.' },
    );
  };

  const share = async () => {
    if (!blob) return;
    const r = await shareImage(blob, filename, text);
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
      await navigator.clipboard.writeText(text);
      setStatus({ kind: 'ok', msg: 'Resumo em texto copiado.' });
    } catch {
      setStatus({ kind: 'error', msg: 'Não foi possível copiar o texto.' });
    }
  };

  const shareSupported = blob ? canShareFiles(blob, filename) : true;

  return (
    <Modal label={title} onClose={onClose}>
      <div className="share-modal">
        <h3 className="share-title">{title}</h3>
        <div className="share-preview" aria-busy={!url}>
          {url ? <img src={url} alt={`Prévia da arte: ${title}`} width={1080} height={1350} /> : error ? <p className="share-error">{error}</p> : <div className="share-loading">Gerando arte…</div>}
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
