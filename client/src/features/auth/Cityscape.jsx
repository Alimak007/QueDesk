/**
 * Full-screen backdrop for the sign-in page: an indigo skyline at dusk.
 *
 * Drawn rather than photographed so it stays sharp at any size, costs a few KB
 * on the one page an unauthenticated visitor loads, and cannot fail to appear
 * when the network is down. The palette is the portal's own brand indigo.
 */

/** Deterministic pseudo-random in [0,1) — the skyline must not reshuffle on every render. */
function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Towers per depth layer: [x, width, height]. Nearer layers are larger and darker. */
const LAYERS = [
  {
    fill: '#26306e',
    edge: 0.1,
    lit: 0.3,
    towers: [
      [0, 120, 300], [128, 84, 400], [220, 150, 240], [380, 96, 470], [486, 132, 330],
      [628, 86, 268], [724, 166, 420], [900, 104, 300], [1014, 138, 380], [1162, 92, 262],
      [1264, 154, 430], [1428, 100, 310], [1538, 130, 366],
    ],
  },
  {
    fill: '#161e4c',
    edge: 0.13,
    lit: 0.5,
    towers: [
      [-20, 150, 470], [140, 116, 620], [268, 190, 390], [470, 132, 560], [614, 168, 446],
      [794, 124, 680], [930, 186, 414], [1128, 116, 540], [1256, 200, 400], [1468, 134, 590],
      [1614, 160, 440],
    ],
  },
  {
    fill: '#070b22',
    edge: 0.16,
    lit: 0.72,
    towers: [
      [-40, 220, 380], [196, 150, 560], [358, 250, 320], [620, 160, 470], [792, 220, 366],
      [1024, 170, 540], [1206, 240, 340], [1458, 168, 500], [1638, 220, 360],
    ],
  },
];

const W = 1600;
const H = 900;
const BASE = 900; // the ground line, in viewBox units

/** Window grid for one tower, thinned out so the lights read as random. */
function windows(x, width, height, seed, brightness) {
  const cells = [];
  const cols = Math.max(1, Math.floor((width - 18) / 16));
  const rows = Math.max(1, Math.floor((height - 24) / 21));

  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (noise(seed + c * 7.13 + r * 3.77) > brightness) continue;
      // A few warm windows among the blue keep it from looking synthetic.
      const warm = noise(seed + c * 2.1 + r) > 0.78;
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={x + 11 + c * 16}
          y={BASE - height + 16 + r * 21}
          width={6}
          height={9}
          rx={1}
          fill={warm ? '#ffd9a0' : '#a5b4fc'}
          opacity={0.22 + noise(seed + c + r * 2) * 0.6}
        />,
      );
    }
  }
  return cells;
}

export function Cityscape({ className }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="qd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05071a" />
          <stop offset="45%" stopColor="#0b1030" />
          <stop offset="80%" stopColor="#1b1f55" />
          <stop offset="100%" stopColor="#2c2a6b" />
        </linearGradient>

        {/* Aurora: two soft blooms that give the sky some weather. */}
        <radialGradient id="qd-aurora-a" cx="18%" cy="20%" r="58%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="qd-aurora-b" cx="86%" cy="10%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>

        {/* The city's own light, thrown up into the haze. */}
        <radialGradient id="qd-citylight" cx="50%" cy="100%" r="72%">
          <stop offset="0%" stopColor="#8b95ff" stopOpacity="0.72" />
          <stop offset="45%" stopColor="#4f46e5" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="qd-air" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.2" />
        </linearGradient>

        <linearGradient id="qd-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05071a" stopOpacity="0" />
          <stop offset="100%" stopColor="#05071a" stopOpacity="0.28" />
        </linearGradient>

        <pattern id="qd-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="#a5b4fc" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width={W} height={H} fill="url(#qd-sky)" />
      <rect width={W} height={H} fill="url(#qd-aurora-a)" />
      <rect width={W} height={H} fill="url(#qd-aurora-b)" />
      {/* A faint blueprint grid: this is a platform, after all. */}
      <rect width={W} height={H} fill="url(#qd-grid)" opacity="0.045" />

      {/* Stars, thinning out towards the lit horizon. */}
      {Array.from({ length: 70 }, (_, i) => {
        const y = noise(i * 4.3) * 420;
        return (
          <circle
            key={i}
            cx={noise(i * 1.7) * W}
            cy={y}
            r={noise(i * 9.1) * 1.1 + 0.3}
            fill="#ffffff"
            opacity={(0.12 + noise(i) * 0.4) * (1 - y / 520)}
          />
        );
      })}

      <rect width={W} height={H} fill="url(#qd-citylight)" />

      {LAYERS.map((layer, li) => (
        <g key={layer.fill}>
          {layer.towers.map(([x, width, height], ti) => (
            <g key={`${x}-${ti}`}>
              <rect x={x} y={BASE - height} width={width} height={height} fill={layer.fill} />
              {/* Lit edges pick each tower out of the one behind it. */}
              <rect x={x} y={BASE - height} width={1.5} height={height} fill="#c7d2fe" opacity={layer.edge} />
              <rect x={x} y={BASE - height} width={width} height={2} fill="#c7d2fe" opacity={layer.edge * 0.8} />
              {windows(x, width, height, li * 137 + ti * 17 + 3, layer.lit * 0.5)}
            </g>
          ))}
        </g>
      ))}

      {/* Atmosphere in front of the towers, thickening towards the ground. */}
      <rect x="0" y={H * 0.35} width={W} height={H * 0.65} fill="url(#qd-air)" />
      <rect x="0" y={H * 0.62} width={W} height={H * 0.38} fill="url(#qd-ground)" />
      <rect width={W} height={H} fill="url(#qd-citylight)" opacity="0.45" />
    </svg>
  );
}
