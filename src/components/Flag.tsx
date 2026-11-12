// Bandeiras simplificadas (SVG) das nacionalidades presentes na base.
import type { ReactElement } from 'react';

const H = (colors: string[]) => (
  <>
    {colors.map((c, i) => (
      <rect key={i} x="0" y={(i * 20) / colors.length} width="30" height={20 / colors.length + 0.2} fill={c} />
    ))}
  </>
);
const V = (colors: string[]) => (
  <>
    {colors.map((c, i) => (
      <rect key={i} x={(i * 30) / colors.length} y="0" width={30 / colors.length + 0.2} height="20" fill={c} />
    ))}
  </>
);

const FLAGS: Record<string, ReactElement> = {
  BRA: (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <path d="M15 2.5 L27.5 10 L15 17.5 L2.5 10 Z" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.4" fill="#002776" />
      <path d="M10.8 9.2 Q15 7.6 19.2 10.4" stroke="#fff" strokeWidth="0.8" fill="none" />
    </>
  ),
  ARG: (
    <>
      {H(['#74acdf', '#ffffff', '#74acdf'])}
      <circle cx="15" cy="10" r="2" fill="#f6b40e" />
    </>
  ),
  URU: (
    <>
      {H(['#fff', '#0038a8', '#fff', '#0038a8', '#fff', '#0038a8', '#fff', '#0038a8', '#fff'])}
      <rect width="11" height="11" fill="#fff" />
      <circle cx="5.5" cy="5.5" r="2.6" fill="#fcd116" />
    </>
  ),
  PAR: H(['#d52b1e', '#ffffff', '#0038a8']),
  CHI: (
    <>
      <rect width="30" height="10" fill="#fff" />
      <rect y="10" width="30" height="10" fill="#d52b1e" />
      <rect width="10" height="10" fill="#0039a6" />
      <circle cx="5" cy="5" r="1.8" fill="#fff" />
    </>
  ),
  COL: (
    <>
      <rect width="30" height="10" fill="#fcd116" />
      <rect y="10" width="30" height="5" fill="#003893" />
      <rect y="15" width="30" height="5" fill="#ce1126" />
    </>
  ),
  ECU: (
    <>
      <rect width="30" height="10" fill="#ffdd00" />
      <rect y="10" width="30" height="5" fill="#034ea2" />
      <rect y="15" width="30" height="5" fill="#ed1c24" />
      <circle cx="15" cy="10" r="2.2" fill="#6b4c1e" />
    </>
  ),
  VEN: (
    <>
      {H(['#ffcc00', '#00247d', '#cf142b'])}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle key={i} cx={9 + i * 1.7} cy={9 + Math.abs(i - 3.5) * 0.45} r="0.5" fill="#fff" />
      ))}
    </>
  ),
  PER: V(['#d91023', '#ffffff', '#d91023']),
  BOL: H(['#d52b1e', '#f9e300', '#007934']),
  JPN: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="5" fill="#bc002d" />
    </>
  ),
  ESP: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
  CRC: H(['#002b7f', '#ffffff', '#ce1126', '#ce1126', '#ffffff', '#002b7f']),
  CMR: (
    <>
      {V(['#007a5e', '#ce1126', '#fcd116'])}
      <circle cx="15" cy="10" r="1.6" fill="#fcd116" />
    </>
  ),
  NED: H(['#ae1c28', '#ffffff', '#21468b']),
  ANG: (
    <>
      {H(['#cc092f', '#000000'])}
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#ffcb00" strokeWidth="1" />
    </>
  ),
  POR: (
    <>
      <rect width="12" height="20" fill="#006600" />
      <rect x="12" width="18" height="20" fill="#ff0000" />
      <circle cx="12" cy="10" r="3.2" fill="#ffcc00" />
    </>
  ),
  SRB: H(['#c6363c', '#0c4076', '#ffffff']),
  POL: H(['#ffffff', '#dc143c']),
  ALG: (
    <>
      {V(['#006233', '#ffffff'])}
      <circle cx="15" cy="10" r="4" fill="#d21034" />
      <circle cx="16.3" cy="10" r="3.3" fill="#fff" />
    </>
  ),
  COD: (
    <>
      <rect width="30" height="20" fill="#007fff" />
      <path d="M0 20 L0 15 L30 0 L30 5 Z" fill="#f7d618" />
      <path d="M0 19 L0 16.5 L30 1.5 L30 4 Z" fill="#ce1021" />
    </>
  ),
  DEN: (
    <>
      <rect width="30" height="20" fill="#c8102e" />
      <rect x="9" width="3" height="20" fill="#fff" />
      <rect y="8.5" width="30" height="3" fill="#fff" />
    </>
  ),
  GHA: (
    <>
      {H(['#ce1126', '#fcd116', '#006b3f'])}
      <circle cx="15" cy="10" r="1.6" fill="#000" />
    </>
  ),
  RSA: (
    <>
      {H(['#de3831', '#ffffff', '#002395'])}
      <path d="M0 0 L12 10 L0 20 Z" fill="#007a4d" />
    </>
  ),
  FRA: V(['#002395', '#ffffff', '#ed2939']),
  ITA: V(['#009246', '#ffffff', '#ce2b37']),
  GER: H(['#000000', '#dd0000', '#ffce00']),
  BEL: V(['#000000', '#fae042', '#ed2939']),
  BUL: H(['#ffffff', '#00966e', '#d62612']),
  USA: (
    <>
      {H(['#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234'])}
      <rect width="13" height="11" fill="#3c3b6e" />
    </>
  ),
  CHN: (
    <>
      <rect width="30" height="20" fill="#de2910" />
      <circle cx="6" cy="6" r="2.4" fill="#ffde00" />
    </>
  ),
};

export const NATIONALITY_NAMES: Record<string, string> = {
  BRA: 'Brasil', ARG: 'Argentina', URU: 'Uruguai', PAR: 'Paraguai', CHI: 'Chile', COL: 'Colômbia', ECU: 'Equador',
  VEN: 'Venezuela', PER: 'Peru', BOL: 'Bolívia', JPN: 'Japão', ESP: 'Espanha', CRC: 'Costa Rica', CMR: 'Camarões',
  NED: 'Países Baixos', ANG: 'Angola', POR: 'Portugal', SRB: 'Sérvia', POL: 'Polônia', ALG: 'Argélia', COD: 'RD Congo',
  DEN: 'Dinamarca', GHA: 'Gana', RSA: 'África do Sul', FRA: 'França', ITA: 'Itália', GER: 'Alemanha', BEL: 'Bélgica',
  BUL: 'Bulgária', USA: 'Estados Unidos', CHN: 'China',
};

export function Flag({ code, size = 18 }: { code: string; size?: number }) {
  const f = FLAGS[code];
  const name = NATIONALITY_NAMES[code] ?? code;
  if (!f) {
    return (
      <span className="flag-fallback" title={name} style={{ fontSize: size * 0.5 }}>
        {code}
      </span>
    );
  }
  return (
    <svg className="flag" width={size * 1.5} height={size} viewBox="0 0 30 20" role="img" aria-label={name}>
      <title>{name}</title>
      {f}
      <rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="0.6" />
    </svg>
  );
}
