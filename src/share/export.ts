// Exportação das artes: PNG, download, cópia para a área de transferência e
// compartilhamento nativo, com alternativas quando o navegador não oferece algo.

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png'));
}

/** Nome de arquivo seguro (sem acentos e espaços). */
export function fileSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ClaudeRuntime = { use?: (name: string) => Promise<unknown> };
type DownloadsApi = { save: (req: { filename: string; data: Blob }) => Promise<{ status: string }> } | null;

async function claudeDownloads(): Promise<DownloadsApi> {
  const claude = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!claude?.use) return null;
  try {
    return (await claude.use('downloads')) as DownloadsApi;
  } catch {
    return null;
  }
}

export type SaveOutcome = 'saved' | 'declined' | 'failed';

/** Baixa o arquivo (na página publicada no Claude, pede confirmação ao visitante). */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveOutcome> {
  const dl = await claudeDownloads();
  if (dl) {
    try {
      await dl.save({ filename, data: blob });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return 'declined';
      if (code !== 'unavailable' && code !== 'not_granted' && code !== 'capability_disabled' && code !== 'capability_removed') return 'failed';
      // sem o recurso nesta página: tenta o download comum
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

/** Copia a imagem; false se o navegador não permitir. */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export function canShareFiles(blob: Blob, filename: string): boolean {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/** Abre o compartilhamento nativo com o arquivo da arte. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  if (!canShareFiles(blob, filename)) return 'unsupported';
  try {
    await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })], title: 'PRAG Onze BR Lendário', text });
    return 'shared';
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'unsupported';
    return 'failed';
  }
}
