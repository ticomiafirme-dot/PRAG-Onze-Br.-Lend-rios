// Cliente mínimo e educado para a API da Wikipédia/Commons.
// - requisições sequenciais com intervalo
// - User-Agent identificando o script
// - novas tentativas com espera crescente em caso de limite de taxa
// Usa o curl do sistema (respeita HTTPS_PROXY e o bundle de CAs do ambiente).
import { execFile } from 'node:child_process';

const UA = 'OnzeBrLendarioDataCheck/1.0 (historical football data verification script)';
const MIN_INTERVAL_MS = 1200;
let last = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function curl(url) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sS', '--compressed', '-A', UA, '-w', '\n%{http_code}', url],
      { maxBuffer: 256 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        const idx = stdout.lastIndexOf('\n');
        resolve({ status: Number(stdout.slice(idx + 1)), body: stdout.slice(0, idx) });
      },
    );
  });
}

export async function wikiApi(host, params) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  for (let attempt = 0; attempt < 8; attempt++) {
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const { status, body } = await curl(url);
      if (status === 429 || status >= 500) throw new Error('HTTP ' + status);
      const json = JSON.parse(body);
      if (json.error?.code === 'maxlag') throw new Error('maxlag');
      if (json.error) throw new Error('API error: ' + JSON.stringify(json.error));
      return json;
    } catch (err) {
      const backoff = 2000 * 2 ** attempt;
      process.stderr.write(`  ! ${host} tentativa ${attempt + 1}: ${err.message.slice(0, 120)} — aguardando ${backoff}ms\n`);
      await sleep(backoff);
    }
  }
  throw new Error('Falha definitiva: ' + url.slice(0, 200));
}

/** Lista todos os membros (ns=0) de uma categoria. */
export async function categoryMembers(host, category) {
  const out = [];
  let cont = {};
  do {
    const j = await wikiApi(host, {
      action: 'query',
      list: 'categorymembers',
      cmtitle: (host.startsWith('pt') ? 'Categoria:' : 'Category:') + category,
      cmnamespace: '0',
      cmlimit: '500',
      ...cont,
    });
    for (const m of j.query.categorymembers) out.push(m.title);
    cont = j.continue ?? null;
  } while (cont);
  return out;
}

/**
 * Busca, em lotes de 50, a seção 0 (infobox) + imagem livre + item Wikidata.
 * Retorna mapa título -> { title, pageid, wikidata, image, content }.
 */
export async function fetchLeadSections(host, titles) {
  const result = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont = {};
    const pages = new Map();
    do {
      const j = await wikiApi(host, {
        action: 'query',
        prop: 'revisions|pageimages|pageprops',
        rvprop: 'content',
        rvslots: 'main',
        rvsection: '0',
        piprop: 'thumbnail|name',
        pithumbsize: '320',
        pilicense: 'free',
        pilimit: '50',
        ppprop: 'wikibase_item',
        redirects: '1',
        titles: batch.join('|'),
        ...cont,
      });
      for (const p of j.query?.pages ?? []) {
        if (p.missing) continue;
        const prev = pages.get(p.title) ?? { title: p.title, pageid: p.pageid };
        const content = p.revisions?.[0]?.slots?.main?.content;
        if (content) prev.content = content;
        if (p.pageprops?.wikibase_item) prev.wikidata = p.pageprops.wikibase_item;
        if (p.pageimage) prev.image = { file: p.pageimage, thumb: p.thumbnail?.source ?? null };
        pages.set(p.title, prev);
      }
      cont = j.continue ?? null;
    } while (cont);
    for (const [t, p] of pages) result.set(t, p);
    process.stderr.write(`  ${host}: ${Math.min(i + 50, titles.length)}/${titles.length}\n`);
  }
  return result;
}

/** Metadados de licença/autoria de arquivos do Commons (lotes de 50). */
export async function commonsImageInfo(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50).map((f) => 'File:' + f);
    const j = await wikiApi('commons.wikimedia.org', {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url',
      iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Credit',
      iiurlwidth: '320',
      titles: batch.join('|'),
    });
    const norm = new Map((j.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of j.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const md = ii.extmetadata ?? {};
      const strip = (v) => (v ? String(v).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null);
      const original = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
      out.set(original.replace(/ /g, '_'), {
        file: p.title.replace(/^File:/, ''),
        thumb: ii.thumburl ?? null,
        page: ii.descriptionurl ?? null,
        author: strip(md.Artist?.value),
        license: strip(md.LicenseShortName?.value),
        licenseUrl: md.LicenseUrl?.value ?? null,
      });
    }
    process.stderr.write(`  commons: ${Math.min(i + 50, files.length)}/${files.length}\n`);
  }
  return out;
}
