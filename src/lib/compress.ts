// Compactação de JSON (gzip + base64) para guardar registros grandes no
// navegador e na nuvem ocupando bem menos espaço.
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

export function packJSON(value: unknown): string {
  const gz = gzipSync(strToU8(JSON.stringify(value)), { level: 6 });
  return btoa(strFromU8(gz, true));
}

export function unpackJSON<T>(packed: string): T {
  return JSON.parse(strFromU8(gunzipSync(strToU8(atob(packed), true)))) as T;
}
