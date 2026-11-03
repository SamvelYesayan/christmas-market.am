// Original, procedurally drawn illustrations for every product and decorative motif.
// <Art art={{ type: 'ornament', c1, c2, shape }} /> — uploaded product photos always take precedence.
import { useId } from 'react';

const GOLD = '#f2c46d';
const SNOW = '#f6f8ff';

function Defs({ id, c1, c2 }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
        <stop offset="0" stopColor={c2} stopOpacity="0.45" />
        <stop offset="1" stopColor={c2} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={lighten(c1, 0.25)} />
        <stop offset="1" stopColor={darken(c1, 0.35)} />
      </linearGradient>
      <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={lighten(c2, 0.2)} />
        <stop offset="1" stopColor={darken(c2, 0.25)} />
      </linearGradient>
      <radialGradient id={`${id}-shine`} cx="35%" cy="30%" r="40%">
        <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff1c9" />
        <stop offset="0.5" stopColor={GOLD} />
        <stop offset="1" stopColor="#a87a1c" />
      </linearGradient>
    </defs>
  );
}

function hex(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? '');
  const n = m ? parseInt(m[1], 16) : 0xc8102e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const lighten = (c, k) => toHex(hex(c).map((v) => v + (255 - v) * k));
export const darken = (c, k) => toHex(hex(c).map((v) => v * (1 - k)));

const star = (cx, cy, r, inner = 0.45, points = 5) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const rr = i % 2 ? r * inner : r;
    const a = (i * Math.PI) / points - Math.PI / 2;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');

const flake = (cx, cy, r, stroke = SNOW, w = 3) => (
  <g stroke={stroke} strokeWidth={w} strokeLinecap="round" fill="none">
    {[0, 60, 120].map((a) => (
      <g key={a} transform={`rotate(${a} ${cx} ${cy})`}>
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
        <path d={`M${cx + r * 0.55} ${cy} l${r * 0.22} ${-r * 0.22} M${cx + r * 0.55} ${cy} l${r * 0.22} ${r * 0.22} M${cx - r * 0.55} ${cy} l${-r * 0.22} ${-r * 0.22} M${cx - r * 0.55} ${cy} l${-r * 0.22} ${r * 0.22}`} />
      </g>
    ))}
  </g>
);

const bulbs = (pts, colors) => pts.map(([x, y], i) => (
  <g key={i} className="art-bulb" style={{ animationDelay: `${(i % 5) * 0.35}s` }}>
    <circle cx={x} cy={y} r="7" fill={colors[i % colors.length]} opacity="0.35" />
    <circle cx={x} cy={y} r="3.6" fill={colors[i % colors.length]} />
  </g>
));

const DRAW = {
  tree: (id, { c1, c2, frosted, small }) => (
    <g transform={small ? 'translate(25 30) scale(0.75)' : undefined}>
      <rect x="90" y="160" width="20" height="22" rx="3" fill="#6b3f22" />
      {small && <path d="M62 178 h76 l-8 22 h-60z" fill={c2} />}
      {[[100, 30, 46, 88], [100, 62, 60, 128], [100, 98, 74, 168]].map(([x, top, half, bottom], i) => (
        <path key={i} d={`M${x} ${top} L${x + half} ${bottom} Q${x} ${bottom - 10} ${x - half} ${bottom} Z`} fill={`url(#${id}-a)`} />
      ))}
      {frosted && <path d="M62 128 q14 -8 26 0 q12 -8 24 0 q12 -8 26 0 M50 168 q16 -9 32 0 q16 -9 34 0 q16 -9 34 0" stroke={SNOW} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />}
      <path d="M66 112 Q100 126 134 108 M56 150 Q100 166 148 146" stroke={GOLD} strokeWidth="2" fill="none" opacity="0.8" />
      {bulbs([[72, 114], [92, 120], [114, 118], [130, 110], [62, 152], [84, 158], [108, 160], [132, 152], [100, 82], [84, 86], [116, 84]], [c2, GOLD, '#ffffff', '#ff6b6b'])}
      <polygon points={star(100, 26, 13)} fill={`url(#${id}-gold)`} className="art-twinkle" />
    </g>
  ),
  ornament: (id, { c1, c2, shape }) => shape === 'pomegranate' ? (
    <g>
      <line x1="100" y1="10" x2="100" y2="42" stroke={GOLD} strokeWidth="1.5" />
      <path d="M100 52 c 40 0 62 28 62 62 c0 38 -28 66 -62 66 c-34 0 -62 -28 -62 -66 c0 -34 22 -62 62 -62z" fill={`url(#${id}-a)`} />
      <path d="M86 52 l6 -12 l8 8 l8 -8 l6 12 z" fill={darken(c1, 0.2)} stroke={GOLD} strokeWidth="1.5" />
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx={74 + (i % 5) * 13} cy={98 + Math.floor(i / 5) * 18} rx="4" ry="5.5" fill={`url(#${id}-gold)`} opacity="0.95" />
      ))}
      <ellipse cx="78" cy="84" rx="20" ry="26" fill={`url(#${id}-shine)`} />
    </g>
  ) : shape === 'disc' ? (
    <g>
      <path d="M100 8 v30" stroke={c2} strokeWidth="5" />
      <circle cx="100" cy="108" r="66" fill={`url(#${id}-gold)`} />
      <circle cx="100" cy="108" r="56" fill="none" stroke={darken(GOLD, 0.35)} strokeWidth="1.5" strokeDasharray="2 4" />
      <text x="100" y="104" textAnchor="middle" fontFamily="Pinyon Script, cursive" fontSize="30" fill={darken(GOLD, 0.6)}>Your name</text>
      <text x="100" y="132" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" letterSpacing="4" fill={darken(GOLD, 0.55)}>2026</text>
      <circle cx="100" cy="46" r="7" fill="none" stroke={darken(GOLD, 0.3)} strokeWidth="3" />
    </g>
  ) : (
    <g>
      <line x1="100" y1="8" x2="100" y2="40" stroke={GOLD} strokeWidth="1.5" />
      <rect x="86" y="38" width="28" height="16" rx="3" fill={`url(#${id}-gold)`} />
      <circle cx="100" cy="116" r="64" fill={`url(#${id}-a)`} />
      <path d="M40 104 Q100 124 160 104 M38 128 Q100 150 162 128" stroke={GOLD} strokeWidth="3" fill="none" />
      {[60, 80, 100, 120, 140].map((x, i) => <polygon key={x} points={star(x, 116 + (i % 2 ? -4 : 4), 6)} fill={lighten(c2, 0.4)} />)}
      <ellipse cx="76" cy="88" rx="20" ry="28" fill={`url(#${id}-shine)`} transform="rotate(-20 76 88)" />
    </g>
  ),
  star: (id) => (
    <g>
      <polygon points={star(100, 100, 74, 0.42, 8)} fill={`url(#${id}-gold)`} className="art-twinkle" />
      <polygon points={star(100, 100, 40, 0.5, 8)} fill="#fff6dc" opacity="0.8" />
      <circle cx="100" cy="100" r="14" fill="#fff" opacity="0.9" />
    </g>
  ),
  snowflake: (id, { c2 }) => (
    <g>
      <circle cx="100" cy="100" r="78" fill={`url(#${id}-glow)`} />
      {flake(100, 100, 66, SNOW, 6)}
      {flake(100, 100, 30, c2 ?? '#a9c7ff', 3)}
    </g>
  ),
  wreath: (id, { c1, c2 }) => (
    <g>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return <ellipse key={i} cx={100 + Math.cos(a) * 58} cy={104 + Math.sin(a) * 58} rx="22" ry="11" fill={i % 2 ? darken(c1, 0.15) : c1} transform={`rotate(${(a * 180) / Math.PI + 70} ${100 + Math.cos(a) * 58} ${104 + Math.sin(a) * 58})`} />;
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        return <circle key={i} cx={100 + Math.cos(a) * 60} cy={104 + Math.sin(a) * 60} r="8" fill={c2} stroke={darken(c2, 0.3)} />;
      })}
      <path d="M100 150 l-24 30 l14 -2 l10 -14 l10 14 l14 2z" fill={c2} />
      <path d="M100 150 c-26 -20 -34 4 -14 6 c-20 4 -6 22 14 -6 c20 28 34 10 14 6 c20 -2 12 -26 -14 -6z" fill={darken(c2, 0.1)} />
    </g>
  ),
  garland: (id, { c1, c2 }) => (
    <g>
      <path d="M10 60 Q100 160 190 60" stroke={c1} strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M10 60 Q100 160 190 60" stroke={darken(c1, 0.3)} strokeWidth="22" fill="none" strokeDasharray="4 6" />
      {[[40, 92], [70, 112], [100, 118], [130, 112], [160, 92]].map(([x, y]) => (
        <g key={x}><path d={`M${x} ${y} v12`} stroke={GOLD} strokeWidth="2" /><path d={`M${x - 8} ${y + 24} q8 -16 16 0 z`} fill={`url(#${id}-gold)`} /></g>
      ))}
      <path d="M90 108 c-30 -24 -40 6 -16 10 c-18 8 2 22 16 -6 c14 28 34 14 16 6 c24 -4 14 -34 -16 -10z" fill={c2} />
    </g>
  ),
  lights: (id, { c1, c2, curtain, festoon }) => curtain ? (
    <g>
      <path d="M20 30 H180" stroke="#2b3a58" strokeWidth="3" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <line x1={28 + i * 18} y1="30" x2={28 + i * 18} y2={120 + (i % 3) * 22} stroke="#2b3a58" strokeWidth="1" />
          {bulbs(Array.from({ length: 5 }, (_, k) => [28 + i * 18, 46 + k * 20 + (i % 3) * 4]), [c1, c2, '#fff'])}
        </g>
      ))}
    </g>
  ) : (
    <g>
      <path d="M8 70 Q60 130 100 90 T192 100" stroke="#2b3a58" strokeWidth="2.5" fill="none" />
      <path d="M8 120 Q70 180 120 140 T192 150" stroke="#2b3a58" strokeWidth="2.5" fill="none" />
      {[[22, 88], [44, 106], [66, 110], [88, 98], [110, 86], [134, 86], [158, 96], [182, 100], [24, 138], [50, 158], [78, 162], [104, 148], [128, 138], [154, 140], [180, 150]].map(([x, y], i) => (
        <g key={i} className="art-bulb" style={{ animationDelay: `${(i % 4) * 0.4}s` }}>
          <rect x={x - 3} y={y - 4} width="6" height="6" fill="#55607a" />
          <ellipse cx={x} cy={y + (festoon ? 10 : 9)} rx={festoon ? 8 : 5.5} ry={festoon ? 11 : 8} fill={[c1, c2, GOLD][i % 3]} />
          <ellipse cx={x} cy={y + 9} rx="16" ry="16" fill={[c1, c2, GOLD][i % 3]} opacity="0.18" />
        </g>
      ))}
    </g>
  ),
  snowglobe: (id, { c1, c2, scene }) => (
    <g>
      <path d="M50 156 h100 l10 30 h-120z" fill={`url(#${id}-gold)`} />
      <rect x="44" y="180" width="112" height="10" rx="4" fill={darken(GOLD, 0.45)} />
      <circle cx="100" cy="94" r="68" fill={c1} />
      <circle cx="100" cy="94" r="68" fill={`url(#${id}-glow)`} />
      {scene === 'aurora' && <path d="M40 70 Q80 40 110 70 T170 60" stroke="#7fe0c4" strokeWidth="10" fill="none" opacity="0.6" className="art-aurora" />}
      {scene === 'aurora' && <path d="M60 140 L100 86 L140 140 z" fill="#e8f1ff" />}
      {scene === 'village' ? (
        <g>
          {[[62, 118, 22], [88, 110, 24], [116, 116, 22], [138, 122, 18]].map(([x, y, s], i) => (
            <g key={i}><rect x={x} y={y} width={s} height={s} fill="#3c2a48" /><path d={`M${x - 3} ${y} l${s / 2 + 3} -${s / 2} l${s / 2 + 3} ${s / 2}z`} fill={SNOW} /><rect x={x + s / 3} y={y + s / 3} width={s / 3} height={s / 3} fill={GOLD} className="art-window" style={{ animationDelay: `${i * 0.7}s` }} /></g>
          ))}
        </g>
      ) : scene === 'tree' ? (
        <g>
          <path d="M100 66 L126 132 H74z" fill="#0f6b4f" />
          {bulbs([[92, 104], [108, 112], [98, 122], [112, 96]], [GOLD, '#ff6b6b'])}
          <polygon points={star(100, 64, 7)} fill={GOLD} className="art-twinkle" />
        </g>
      ) : null}
      <path d="M36 140 Q100 126 164 140 Q160 158 100 160 Q40 158 36 140z" fill={SNOW} />
      {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={52 + ((i * 37) % 96)} cy={46 + ((i * 53) % 84)} r={1.4 + (i % 3)} fill="#fff" opacity="0.9" className="art-snow" style={{ animationDelay: `${i * 0.3}s` }} />)}
      <circle cx="100" cy="94" r="68" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
      <ellipse cx="72" cy="62" rx="18" ry="30" fill={`url(#${id}-shine)`} transform="rotate(30 72 62)" />
    </g>
  ),
  giftbox: (id, { c1, c2, mystery }) => (
    <g>
      <rect x="36" y="88" width="128" height="96" rx="6" fill={`url(#${id}-a)`} />
      <rect x="28" y="66" width="144" height="32" rx="6" fill={lighten(c1, 0.12)} className="art-lid" />
      <rect x="90" y="66" width="20" height="118" fill={`url(#${id}-b)`} />
      <rect x="28" y="76" width="144" height="12" fill={`url(#${id}-b)`} className="art-lid" />
      <path d="M100 66 c-36 -40 -60 -6 -30 0 z M100 66 c36 -40 60 -6 30 0z" fill={`url(#${id}-b)`} stroke={darken(c2, 0.3)} strokeWidth="1.5" className="art-lid" />
      {mystery && <text x="100" y="150" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="44" fontWeight="700" fill={lighten(c2, 0.5)}>?</text>}
      {Array.from({ length: 6 }, (_, i) => <polygon key={i} points={star(48 + i * 21, 172 - (i % 2) * 52, 4)} fill="#fff" opacity="0.5" />)}
    </g>
  ),
  teddy: (id, { c1, c2 }) => (
    <g>
      <circle cx="62" cy="50" r="18" fill={c1} /><circle cx="138" cy="50" r="18" fill={c1} />
      <path d="M56 42 l-14 -34 l20 26z M144 42 l14 -34 l-20 26z" fill={darken(c1, 0.25)} />
      <ellipse cx="100" cy="142" rx="50" ry="46" fill={`url(#${id}-a)`} />
      <circle cx="100" cy="78" r="40" fill={`url(#${id}-a)`} />
      <ellipse cx="100" cy="92" rx="18" ry="13" fill={lighten(c1, 0.4)} />
      <ellipse cx="100" cy="86" rx="7" ry="5" fill="#2b1810" />
      <circle cx="86" cy="72" r="4" fill="#2b1810" /><circle cx="114" cy="72" r="4" fill="#2b1810" />
      <path d="M62 112 q38 22 76 0 l-4 14 q-34 16 -68 0z" fill={c2} />
      <path d="M118 120 l12 34 l-12 -6 l-8 8z" fill={c2} />
      <path d="M92 148 c-12 -12 -24 2 -8 14 l8 6 l8 -6 c16 -12 4 -26 -8 -14z" fill={c2} />
    </g>
  ),
  lantern: (id, { c1, c2, projector }) => (
    <g>
      <path d="M86 20 q14 -14 28 0" stroke={darken(c1, 0.2)} strokeWidth="5" fill="none" />
      <path d="M70 30 h60 l-6 18 h-48z" fill={`url(#${id}-a)`} />
      <rect x="66" y="48" width="68" height="104" rx="8" fill={c1} />
      <rect x="76" y="58" width="48" height="84" rx="4" fill={c2} opacity="0.95" />
      <ellipse cx="100" cy="104" rx="16" ry="26" fill="#fff6dc" className="art-flame" />
      <ellipse cx="100" cy="104" rx="40" ry="50" fill={`url(#${id}-glow)`} />
      {projector && Array.from({ length: 8 }, (_, i) => <polygon key={i} points={star(30 + i * 20, 176 + (i % 2) * 10, 3)} fill={c2} opacity="0.8" />)}
      <path d="M62 152 h76 l-6 16 h-64z" fill={`url(#${id}-a)`} />
    </g>
  ),
  sleigh: (id, { c1 }) => (
    <g>
      <path d="M40 80 h90 q22 0 30 30 l6 30 h-116 q-14 0 -14 -20z" fill={`url(#${id}-a)`} />
      <path d="M48 96 h80" stroke={GOLD} strokeWidth="3" />
      <path d="M30 160 h140 q20 0 18 -18" stroke={GOLD} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M60 140 v20 M140 140 v20" stroke={GOLD} strokeWidth="5" />
      <rect x="66" y="52" width="34" height="30" rx="3" fill="#0f6b4f" /><rect x="80" y="52" width="6" height="30" fill={GOLD} />
      <rect x="104" y="60" width="28" height="22" rx="3" fill={lighten(c1, 0.4)} />
    </g>
  ),
  mug: (id, { c1 }) => (
    <g>
      <path d="M78 40 q-10 -14 0 -26 M100 40 q-10 -14 0 -26 M122 40 q-10 -14 0 -26" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" fill="none" className="art-steam" />
      <path d="M50 56 h100 v84 q0 30 -30 30 h-40 q-30 0 -30 -30z" fill={`url(#${id}-a)`} />
      <path d="M150 76 q32 0 30 30 q-2 26 -30 24" stroke={darken(c1, 0.2)} strokeWidth="12" fill="none" />
      <path d="M50 56 h100 v14 q-50 10 -100 0z" fill={GOLD} opacity="0.8" />
      {flake(100, 116, 18, GOLD, 2.5)}
    </g>
  ),
  book: (id, { c1 }) => (
    <g>
      <path d="M44 34 h104 q8 0 8 8 v124 q0 8 -8 8 h-104z" fill={`url(#${id}-a)`} />
      <rect x="44" y="34" width="14" height="140" fill={darken(c1, 0.35)} />
      <rect x="150" y="40" width="10" height="130" fill="#f3e6c8" />
      <rect x="72" y="58" width="66" height="92" rx="4" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <polygon points={star(105, 96, 16, 0.4, 8)} fill={`url(#${id}-gold)`} className="art-twinkle" />
      <circle cx="88" cy="128" r="2" fill={GOLD} /><circle cx="122" cy="122" r="2.5" fill={GOLD} /><circle cx="110" cy="136" r="1.6" fill={GOLD} />
    </g>
  ),
  scarf: (id, { c1, c2, throw: isThrow }) => isThrow ? (
    <g>
      <path d="M30 60 q70 -24 140 0 v90 q-70 24 -140 0z" fill={c1} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M30 ${74 + i * 22} q70 -24 140 0`} stroke={c2} strokeWidth="3" fill="none" opacity="0.6" />)}
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${36 + i * 14} 156 v14`} stroke={c1} strokeWidth="3" />)}
      {flake(100, 104, 16, c2, 2)}
    </g>
  ) : (
    <g>
      <path d="M60 30 q40 26 80 0 l10 30 q-50 30 -100 0z" fill={c1} />
      <path d="M110 56 l18 120 h-34 l-14 -116z" fill={c1} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={98 + i * 1.5} y={76 + i * 20} width="30" height="8" fill={c2} transform={`skewX(${8})`} />)}
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${96 + i * 6} 176 v16`} stroke={c1} strokeWidth="3" />)}
    </g>
  ),
  candle: (id, { c1, c2 }) => (
    <g>
      <ellipse cx="100" cy="40" rx="30" ry="44" fill={`url(#${id}-glow)`} />
      <path d="M100 22 q12 18 0 32 q-12 -14 0 -32z" fill="#ffd27a" className="art-flame" />
      <line x1="100" y1="54" x2="100" y2="64" stroke="#3a2a1a" strokeWidth="3" />
      <rect x="58" y="62" width="84" height="116" rx="10" fill={`url(#${id}-a)`} />
      <rect x="58" y="96" width="84" height="40" fill="#f3e6c8" />
      <text x="100" y="114" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" letterSpacing="2" fill={darken(c1, 0.3)}>PINE &amp;</text>
      <text x="100" y="128" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" letterSpacing="2" fill={darken(c1, 0.3)}>EMBER</text>
      <path d="M58 70 q42 8 84 0" stroke={lighten(c2, 0.3)} strokeWidth="3" fill="none" />
    </g>
  ),
  cookie: (id, { c1 }) => (
    <g>
      {[[70, 110], [130, 110], [100, 66]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="34" fill={`url(#${id}-a)`} />
          <path d={`M${x - 26} ${y - 8} q26 -18 52 0`} stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx={x - 8} cy={y + 10} r="3" fill={lighten(c1, 0.5)} /><circle cx={x + 10} cy={y + 4} r="2.5" fill={lighten(c1, 0.5)} />
        </g>
      ))}
    </g>
  ),
  stocking: (id, { c1, c2 }) => (
    <g>
      <path d="M70 50 h60 v80 q0 10 10 18 l14 12 q14 16 -6 28 q-14 8 -30 -4 l-40 -30 q-8 -6 -8 -16z" fill={`url(#${id}-a)`} />
      <rect x="62" y="30" width="76" height="30" rx="8" fill={c2 === '#f6f8ff' ? SNOW : '#f6f8ff'} />
      <text x="100" y="51" textAnchor="middle" fontFamily="Pinyon Script, cursive" fontSize="20" fill={GOLD} stroke="#a87a1c" strokeWidth="0.3">Name</text>
      {[0, 1, 2].map((i) => <polygon key={i} points={star(86 + i * 14, 90 + i * 16, 6)} fill={GOLD} opacity="0.85" />)}
    </g>
  ),
  scroll: (id, { c1, c2 }) => (
    <g>
      <rect x="44" y="40" width="112" height="128" rx="4" fill={c1} />
      <path d="M44 40 q56 10 112 0" stroke={darken(c1, 0.15)} fill="none" />
      {[64, 80, 96, 112].map((y, i) => <path key={y} d={`M60 ${y} q${20 + i * 3} -4 ${70 - i * 6} 0`} stroke={darken(c1, 0.45)} strokeWidth="1.5" fill="none" opacity="0.7" />)}
      <circle cx="132" cy="146" r="18" fill={c2} />
      <circle cx="132" cy="146" r="12" fill={darken(c2, 0.2)} />
      {flake(132, 146, 8, lighten(c2, 0.5), 1.6)}
    </g>
  ),
  musicbox: (id, { c1, c2 }) => (
    <g>
      <rect x="36" y="110" width="128" height="66" rx="6" fill="#5a3524" />
      <rect x="36" y="110" width="128" height="10" fill="#7a4a30" />
      <circle cx="100" cy="72" r="46" fill={c1} opacity="0.95" />
      {[[80, 56], [112, 50], [124, 80], [92, 88], [104, 70], [70, 80]].map(([x, y], i) => <polygon key={i} points={star(x, y, 5)} fill={c2} className="art-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />)}
      <path d="M80 56 L104 70 L112 50 M104 70 L124 80 M104 70 L92 88 L70 80" stroke={c2} strokeWidth="1" opacity="0.6" />
      <line x1="100" y1="118" x2="100" y2="104" stroke={GOLD} strokeWidth="3" />
      <path d="M150 140 h18 v10 h-18z" fill={GOLD} />
    </g>
  ),
  wand: (id, { c1, c2 }) => (
    <g>
      <path d="M40 172 L150 50" stroke={darken(c1, 0.35)} strokeWidth="12" strokeLinecap="round" />
      <path d="M40 172 L150 50" stroke={c1} strokeWidth="8" strokeLinecap="round" />
      <path d="M52 158 l14 -14 M58 152 l8 -8" stroke={darken(c1, 0.5)} strokeWidth="3" />
      <path d="M150 50 l12 -14 l-4 18z" fill={c2} />
      <circle cx="158" cy="40" r="24" fill={`url(#${id}-glow)`} />
      {[[168, 26], [176, 48], [146, 22], [184, 34]].map(([x, y], i) => <polygon key={i} points={star(x, y, 5 - (i % 2) * 2)} fill={c2} className="art-twinkle" style={{ animationDelay: `${i * 0.3}s` }} />)}
    </g>
  ),
  sweater: (id, { c1, c2, tartan }) => (
    <g>
      <path d="M70 30 q30 16 60 0 l46 24 l-14 44 l-20 -8 v92 h-84 v-92 l-20 8 l-14 -44z" fill={`url(#${id}-a)`} />
      {tartan ? (
        <g opacity="0.45">{[60, 80, 100, 120, 140].map((x) => <line key={x} x1={x} y1="40" x2={x} y2="182" stroke={c2} strokeWidth="4" />)}{[60, 90, 120, 150].map((y) => <line key={y} x1="58" y1={y} x2="142" y2={y} stroke={c2} strokeWidth="4" />)}</g>
      ) : (
        <g>
          <path d="M58 74 h84" stroke={c2} strokeWidth="4" strokeDasharray="6 4" />
          {[70, 90, 110, 130].map((x) => <polygon key={x} points={star(x, 92, 6, 0.4, 6)} fill={c2} />)}
          <path d="M58 110 h84" stroke={c2} strokeWidth="4" strokeDasharray="6 4" />
          <path d="M84 128 l16 -12 l16 12 v20 h-32z" fill={c2} opacity="0.85" />
        </g>
      )}
      <path d="M70 30 q30 16 60 0" stroke={darken(c1, 0.3)} strokeWidth="6" fill="none" />
    </g>
  ),
  mittens: (id, { c1, c2 }) => (
    <g>
      {[[44, 0], [100, 1]].map(([x, flip]) => (
        <g key={x} transform={flip ? `translate(${x * 2 + 56} 0) scale(-1 1)` : undefined}>
          <path d={`M${x} 60 q0 -30 28 -30 q28 0 28 30 v60 h-56z`} fill={`url(#${id}-a)`} />
          <path d={`M${x} 90 q-18 -4 -16 -22 q4 -12 16 -4`} fill={c1} />
          <rect x={x - 4} y="118" width="64" height="26" rx="6" fill={c2} />
          {flake(x + 28, 78, 12, c2, 2)}
        </g>
      ))}
      <path d="M72 144 q28 50 56 0" stroke={c2} strokeWidth="2" fill="none" />
    </g>
  ),
  bell: (id, { c1, c2 }) => (
    <g>
      <path d="M100 24 v16" stroke={c2} strokeWidth="4" />
      <path d="M100 40 c-34 0 -40 34 -40 60 c0 24 -14 34 -20 40 h120 c-6 -6 -20 -16 -20 -40 c0 -26 -6 -60 -40 -60z" fill={`url(#${id}-a)`} />
      <circle cx="100" cy="148" r="12" fill={darken(c1, 0.3)} />
      <path d="M70 30 c-20 -14 -34 6 -14 10 c-16 6 -2 20 14 -4z M130 30 c20 -14 34 6 14 10 c16 6 2 20 -14 -4z" fill={c2} />
      <ellipse cx="82" cy="78" rx="8" ry="20" fill={`url(#${id}-shine)`} />
    </g>
  ),
  hat: (id, { c1 }) => (
    <g>
      <path d="M54 140 q4 -86 66 -100 q30 -6 34 20 q-24 -10 -30 20 q-6 30 6 60z" fill={`url(#${id}-a)`} />
      <rect x="44" y="132" width="112" height="30" rx="14" fill={SNOW} />
      <circle cx="156" cy="62" r="18" fill={SNOW} />
      <polygon points={star(98, 104, 8)} fill={GOLD} />
    </g>
  ),
  key: (id) => (
    <g>
      <circle cx="70" cy="100" r="34" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="14" />
      <path d="M102 100 h76 v22 M156 100 v16" stroke={`url(#${id}-gold)`} strokeWidth="12" fill="none" />
      <polygon points={star(70, 100, 12)} fill={GOLD} />
    </g>
  ),
  heart: (id, { c1 }) => (
    <path d="M100 168 C 30 120, 30 60, 70 50 C 90 46, 100 62, 100 72 C 100 62, 110 46, 130 50 C 170 60, 170 120, 100 168z" fill={`url(#${id}-a)`} stroke={darken(c1, 0.3)} strokeWidth="2" />
  ),
  moon: (id) => (
    <g>
      <circle cx="100" cy="100" r="70" fill={`url(#${id}-glow)`} />
      <path d="M120 34 a66 66 0 1 0 0 132 a52 52 0 1 1 0 -132z" fill="#fff6dc" />
      {[[150, 60], [160, 120], [134, 160]].map(([x, y], i) => <polygon key={i} points={star(x, y, 6)} fill={GOLD} className="art-twinkle" />)}
    </g>
  ),
  clock: (id, { c1 }) => (
    <g>
      <path d="M50 190 V80 L100 20 L150 80 V190z" fill={darken(c1 ?? '#0b1430', 0.1)} stroke={GOLD} strokeWidth="2" />
      <circle cx="100" cy="92" r="30" fill="#fff6dc" stroke={GOLD} strokeWidth="4" />
      <path d="M100 92 V72 M100 92 L114 100" stroke="#2b1810" strokeWidth="3" strokeLinecap="round" />
      {[124, 150].map((y) => <rect key={y} x="80" y={y} width="40" height="22" rx="10" fill={GOLD} opacity="0.85" />)}
    </g>
  ),
  door: (id, { c1 }) => (
    <g>
      <path d="M50 186 V80 a50 50 0 0 1 100 0 V186z" fill={`url(#${id}-a)`} stroke={GOLD} strokeWidth="3" />
      <circle cx="132" cy="130" r="5" fill={GOLD} />
      <path d="M100 40 v146" stroke={darken(c1 ?? '#c8102e', 0.3)} strokeWidth="2" />
    </g>
  ),
  wheel: (id) => (
    <g>
      {Array.from({ length: 8 }, (_, i) => {
        const a1 = (i / 8) * Math.PI * 2;
        const a2 = ((i + 1) / 8) * Math.PI * 2;
        return <path key={i} d={`M100 100 L${100 + Math.cos(a1) * 76} ${100 + Math.sin(a1) * 76} A76 76 0 0 1 ${100 + Math.cos(a2) * 76} ${100 + Math.sin(a2) * 76}z`} fill={['#c8102e', '#0f6b4f', GOLD, '#2a4fa8'][i % 4]} />;
      })}
      <circle cx="100" cy="100" r="76" fill="none" stroke={GOLD} strokeWidth="6" />
      <circle cx="100" cy="100" r="12" fill={GOLD} />
    </g>
  ),
  card: (id) => (
    <g>
      <rect x="22" y="52" width="156" height="98" rx="12" fill="#14110b" stroke={GOLD} strokeWidth="2" />
      <path d="M22 120 Q100 80 178 110" stroke={GOLD} strokeWidth="1" fill="none" opacity="0.5" />
      <rect x="38" y="72" width="26" height="20" rx="4" fill={`url(#${id}-gold)`} />
      <polygon points={star(150, 80, 12)} fill={GOLD} className="art-twinkle" />
      <text x="38" y="134" fontFamily="Fraunces, serif" fontSize="12" letterSpacing="3" fill={GOLD}>PIONEER</text>
    </g>
  ),
  gift: (id, a) => DRAW.giftbox(id, a),
  eye: (id) => DRAW.star(id),
  crest: (id, a) => DRAW.star(id, a),
};

export default function Art({ art = {}, className = '', title, glow = true }) {
  const rid = useId().replace(/:/g, '');
  const type = DRAW[art.type] ? art.type : 'giftbox';
  const c1 = art.c1 ?? '#c8102e';
  const c2 = art.c2 ?? GOLD;
  return (
    <svg className={`art art-${type} ${className}`} viewBox="0 0 200 200" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Defs id={rid} c1={c1} c2={c2} />
      {glow && <circle cx="100" cy="104" r="96" fill={`url(#${rid}-glow)`} />}
      {DRAW[type](rid, { ...art, c1, c2 })}
    </svg>
  );
}

/** Product image: uploaded photo if present, otherwise the procedural illustration. */
export function ProductVisual({ product, className = '', eager = false }) {
  if (product?.image) {
    return <img className={`product-photo ${className}`} src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
  }
  return <Art art={product?.art} className={className} title={product?.name} />;
}
