// Large decorative scenes: the village skyline (with Mount Ararat), Frostspire castle and house crests.
const GOLD = '#f2c46d';

export function Mountains({ className = '' }) {
  return (
    <svg className={`scene-mountains ${className}`} viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4f86" /><stop offset="1" stopColor="#101a3d" /></linearGradient>
        <linearGradient id="snowcap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6f8ff" /><stop offset="1" stopColor="#bcd0ff" /></linearGradient>
      </defs>
      {/* Masis and Sis — the two peaks of Ararat */}
      <path d="M520 400 L860 110 Q900 80 940 112 L1250 400z" fill="url(#mtn)" />
      <path d="M800 162 L860 110 Q900 80 940 112 L1000 164 Q960 150 930 172 Q900 150 870 176 Q840 152 800 162z" fill="url(#snowcap)" />
      <path d="M1150 400 L1290 240 Q1305 226 1320 240 L1460 400z" fill="url(#mtn)" opacity="0.9" />
      <path d="M1262 272 L1290 240 Q1305 226 1320 240 L1346 270 Q1320 262 1304 276 Q1286 262 1262 272z" fill="url(#snowcap)" />
      <path d="M0 400 L180 250 L300 330 L420 230 L640 400z" fill="#16224a" />
      <path d="M1400 400 L1500 300 L1600 350 V400z" fill="#16224a" />
    </svg>
  );
}

export function Village({ className = '' }) {
  const houses = [
    [40, 70, 60], [110, 90, 70], [190, 60, 54], [260, 110, 74], [350, 80, 62], [430, 120, 86], [530, 70, 58],
    [600, 96, 70], [690, 140, 60], [770, 84, 66], [850, 100, 74], [940, 70, 56], [1010, 124, 80], [1110, 80, 62],
    [1190, 96, 70], [1280, 66, 56], [1350, 110, 76], [1440, 86, 64], [1520, 70, 60],
  ];
  return (
    <svg className={`scene-village ${className}`} viewBox="0 0 1600 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {houses.map(([x, h, w], i) => {
        const y = 240 - h;
        const church = i === 8;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="#0b1430" />
            {church ? (
              <>
                <path d={`M${x - 4} ${y} L${x + w / 2} ${y - 70} L${x + w + 4} ${y}z`} fill="#0b1430" />
                <path d={`M${x + w / 2 - 3} ${y - 90} h6 v24 h-6z M${x + w / 2 - 10} ${y - 82} h20 v5 h-20z`} fill={GOLD} />
                <path d={`M${x + 6} ${y} L${x + w / 2} ${y - 60} L${x + w - 6} ${y}`} stroke="#f6f8ff" strokeWidth="5" fill="none" opacity="0.85" />
              </>
            ) : (
              <>
                <path d={`M${x - 6} ${y + 2} L${x + w / 2} ${y - w * 0.42} L${x + w + 6} ${y + 2}z`} fill="#0b1430" />
                <path d={`M${x - 6} ${y + 2} L${x + w / 2} ${y - w * 0.42} L${x + w + 6} ${y + 2}`} stroke="#f6f8ff" strokeWidth="6" fill="none" opacity="0.9" strokeLinejoin="round" />
              </>
            )}
            {Array.from({ length: Math.floor(h / 34) }, (_, r) =>
              Array.from({ length: Math.max(1, Math.floor(w / 26)) }, (_, c) => (
                (i + r + c) % 3 !== 0 && (
                  <rect key={`${r}-${c}`} className="village-window" style={{ animationDelay: `${((i * 7 + r * 3 + c) % 11) * 0.6}s` }}
                    x={x + 9 + c * 24} y={y + 14 + r * 30} width="11" height="14" rx="2" fill={(i + c) % 4 ? GOLD : '#ffb347'} />
                )
              )))}
            {!church && i % 3 === 0 && <rect x={x + w - 18} y={y - w * 0.32} width="10" height="22" fill="#0b1430" />}
          </g>
        );
      })}
      <path d="M0 232 Q400 216 800 230 T1600 226 V240 H0z" fill="#f6f8ff" />
    </svg>
  );
}

export function Pines({ className = '', count = 9 }) {
  return (
    <svg className={`scene-pines ${className}`} viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const x = (i / (count - 1)) * 1600 + (i % 2 ? 30 : -20);
        const s = 0.7 + ((i * 37) % 10) / 20;
        return (
          <g key={i} transform={`translate(${x} ${260}) scale(${s})`}>
            <path d="M0 -250 L70 -120 L40 -124 L96 -40 L56 -44 L110 0 H-110 L-56 -44 L-96 -40 L-40 -124 L-70 -120z" fill="#071226" />
            <path d="M0 -250 L34 -186 Q0 -176 -34 -186z M-40 -124 Q0 -110 40 -124 L52 -102 Q0 -90 -52 -102z M-56 -44 Q0 -30 56 -44 L70 -24 Q0 -12 -70 -24z" fill="#f6f8ff" opacity="0.92" />
          </g>
        );
      })}
    </svg>
  );
}

export function Castle({ className = '' }) {
  return (
    <svg className={`scene-castle ${className}`} viewBox="0 0 800 460" aria-hidden="true">
      <defs>
        <linearGradient id="castleStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a3a6e" /><stop offset="1" stopColor="#0b1430" /></linearGradient>
        <radialGradient id="gateGlow" cx="50%" cy="80%" r="60%"><stop offset="0" stopColor="#ffe2a8" /><stop offset="1" stopColor="#ffe2a8" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M0 460 Q400 380 800 460z" fill="#f6f8ff" opacity="0.9" />
      {[[110, 150, 70], [250, 70, 80], [470, 40, 90], [620, 130, 70]].map(([x, top, w], i) => (
        <g key={i}>
          <rect x={x} y={top} width={w} height={420 - top} fill="url(#castleStone)" />
          <path d={`M${x - 14} ${top} L${x + w / 2} ${top - w * 1.1} L${x + w + 14} ${top}z`} fill="#16224a" />
          <path d={`M${x - 14} ${top} L${x + w / 2} ${top - w * 1.1} L${x + w + 14} ${top}`} stroke="#f6f8ff" strokeWidth="5" fill="none" />
          <path d={`M${x + w / 2} ${top - w * 1.1} v-30`} stroke={GOLD} strokeWidth="2" />
          <path d={`M${x + w / 2} ${top - w * 1.1 - 30} l18 7 l-18 7z`} fill={['#c8102e', '#0f6b4f', '#2a4fa8', '#b8860b'][i]} className="castle-flag" />
          {[0, 1, 2].map((k) => <rect key={k} className="village-window" style={{ animationDelay: `${i + k}s` }} x={x + w / 2 - 7} y={top + 30 + k * 60} width="14" height="24" rx="7" fill={GOLD} />)}
        </g>
      ))}
      <rect x="170" y="230" width="460" height="190" fill="url(#castleStone)" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={170 + i * 40} y="214" width="22" height="20" fill="#2a3a6e" />)}
      <path d="M350 420 V330 a50 50 0 0 1 100 0 V420z" fill="#1a1208" />
      <path d="M350 420 V330 a50 50 0 0 1 100 0 V420z" fill="url(#gateGlow)" className="castle-gate" />
      <path d="M170 236 h460" stroke="#f6f8ff" strokeWidth="6" />
    </svg>
  );
}

const CREST_GLYPH = {
  emberwyn: 'M0 -30 L14 -6 L30 -22 L22 10 Q0 34 -22 10 L-30 -22 L-14 -6z', // fox
  pinehollow: 'M-4 30 V0 L-26 -20 M-26 -20 L-34 -34 M-26 -20 L-14 -34 M4 30 V0 L26 -20 M26 -20 L34 -34 M26 -20 L14 -34 M-10 6 Q0 18 10 6', // stag antlers
  starloom: 'M0 -24 V26 M0 -6 C -30 -40 -40 0 -6 8 C -36 14 -26 40 0 18 C 26 40 36 14 6 8 C 40 0 30 -40 0 -6', // moth
  aurelith: 'M-22 -30 L-12 -8 Q0 -14 12 -8 L22 -30 L22 0 Q22 26 0 30 Q-22 26 -22 0z', // lynx
};

export function Crest({ house, size = 120, className = '' }) {
  const color = house?.color ?? '#2a4fa8';
  const accent = house?.accent ?? GOLD;
  const glyph = CREST_GLYPH[house?.slug] ?? CREST_GLYPH.starloom;
  const id = `crest-${house?.slug ?? 'x'}`;
  return (
    <svg className={`crest ${className}`} width={size} height={size * 1.2} viewBox="-60 -66 120 144" role="img" aria-label={`${house?.name ?? 'House'} crest`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor="#0b1430" /></linearGradient>
      </defs>
      <path d="M-50 -56 H50 V10 Q50 54 0 74 Q-50 54 -50 10z" fill={`url(#${id})`} stroke={GOLD} strokeWidth="3" />
      <path d="M-42 -48 H42 V10 Q42 46 0 64 Q-42 46 -42 10z" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="1" />
      <g transform="translate(0 4)" fill={house?.slug === 'pinehollow' || house?.slug === 'starloom' ? 'none' : accent} stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={glyph} />
      </g>
      <path d="M-30 -56 l6 -10 l6 10 M-6 -56 l6 -12 l6 12 M18 -56 l6 -10 l6 10" fill={GOLD} />
    </svg>
  );
}
