// 첫 화면 위쪽에 까는 장식용 세계지도. 점으로 찍은 대륙 위에 지원하는 6개국 위치와 나라 사이를 잇는 곡선을 그린다.
// 외부 그림 파일 없이 코드만으로 그려서 화면 크기에 맞춰도 선명하고, 읽어 주는 프로그램(스크린리더)은 건너뛴다.

// 지도 크기: 가로 720 × 세로 280, 1도 = 2칸 (위도 80도 ~ -60도, 경도 -180도 ~ 180도의 단순 평면 투영)
const WIDTH = 720;
const HEIGHT = 280;
const toX = (lon: number) => (lon + 180) * 2;
const toY = (lat: number) => (80 - lat) * 2;

// 위도 5도 띠마다 육지인 경도 구간 [시작, 끝]. 위에서 아래로 위도 77.5도, 72.5도, … -57.5도.
// 대략적인 모양만 담은 값이라 해안선이 정확하진 않다. 장식용이다.
const LAND: [number, number][][] = [
  [[-115, -62], [-72, -15], [10, 30], [55, 70], [95, 105]], // 77.5
  [[-165, -95], [-120, -62], [-70, -20], [15, 30], [30, 70], [75, 180]], // 72.5
  [[-180, -170], [-168, -62], [-55, -22], [-24, -14], [10, 30], [30, 180]], // 67.5
  [[-180, -170], [-165, -95], [-77, -62], [-52, -40], [-24, -14], [5, 30], [30, 180]], // 62.5
  [[-165, -95], [-80, -55], [-6, -2], [5, 15], [20, 30], [30, 140], [155, 165]], // 57.5
  [[-130, -95], [-90, -52], [-10, 0], [5, 30], [30, 140], [155, 160]], // 52.5
  [[-125, -60], [-5, 40], [40, 135]], // 47.5
  [[-125, -60], [-10, 28], [40, 48], [54, 130], [140, 146]], // 42.5
  [[-125, -75], [-10, -1], [8, 18], [20, 47], [54, 122], [125, 129], [132, 142]], // 37.5
  [[-118, -80], [-10, 35], [35, 60], [60, 122], [126, 129], [130, 135]], // 32.5
  [[-115, -97], [-83, -80], [-15, 35], [35, 58], [58, 122], [120, 122]], // 27.5
  [[-110, -98], [-85, -74], [-17, 36], [39, 58], [68, 118], [120, 122]], // 22.5
  [[-105, -88], [-75, -65], [-17, 38], [42, 56], [72, 85], [92, 108], [120, 125]], // 17.5
  [[-92, -83], [-75, -60], [-17, 51], [74, 80], [98, 110], [120, 126]], // 12.5
  [[-80, -52], [-13, 50], [79, 82], [98, 103], [115, 119], [122, 127]], // 7.5
  [[-78, -50], [9, 43], [95, 105], [109, 119], [120, 125]], // 2.5
  [[-80, -35], [10, 42], [100, 105], [110, 116], [119, 125], [132, 150]], // -2.5
  [[-78, -35], [13, 40], [105, 115], [140, 150]], // -7.5
  [[-76, -38], [12, 40], [130, 137], [142, 145]], // -12.5
  [[-72, -40], [12, 45], [44, 50], [125, 145]], // -17.5
  [[-70, -40], [14, 40], [44, 48], [115, 152]], // -22.5
  [[-70, -48], [15, 33], [114, 153]], // -27.5
  [[-72, -55], [17, 30], [115, 152]], // -32.5
  [[-73, -58], [138, 150], [173, 178]], // -37.5
  [[-74, -62], [145, 148], [168, 175]], // -42.5
  [[-75, -66], [166, 170]], // -47.5
  [[-72, -65]], // -52.5
  [], // -57.5
];

// 점 하나를 "M x y h0"로 적고, 둥근 끝을 가진 굵은 선으로 그리면 점이 된다. 점 수천 개도 글 하나로 끝난다.
const DOT_PATH = LAND.flatMap((ranges, row) => {
  const lat = 77.5 - 5 * row;
  const offset = row % 2 === 0 ? 0 : 2; // 한 줄씩 엇갈리게 놓아 벌집 모양으로
  const dots: string[] = [];
  for (let lon = -178 + offset; lon < 180; lon += 4) {
    if (ranges.some(([from, to]) => lon >= from && lon <= to)) dots.push(`M${toX(lon)} ${toY(lat)}h0`);
  }
  return dots;
}).join("");

// 지원하는 6개국의 위치. dx, dy는 이름표를 점에서 얼마나 띄울지.
const MARKERS = [
  { code: "KR", lat: 37.5, lon: 127, dx: -6, dy: 17, anchor: "end" },
  { code: "JP", lat: 36, lon: 138, dx: 8, dy: 5, anchor: "start" },
  { code: "US", lat: 39, lon: -98, dx: 0, dy: -10, anchor: "middle" },
  { code: "GB", lat: 54, lon: -2, dx: -7, dy: -3, anchor: "end" },
  { code: "DE", lat: 51, lon: 10, dx: 8, dy: -5, anchor: "start" },
  { code: "FR", lat: 46.5, lon: 2, dx: -7, dy: 13, anchor: "end" },
] as const;

// 나라 사이를 잇는 곡선. 한국 거주자 기준이라는 이 앱의 관점을 닮아 한국에서 뻗어 나가는 모양이다.
const ARCS = [
  `M${toX(127)} ${toY(37.5)} Q${toX(65)} ${toY(78)} ${toX(10)} ${toY(51)}`, // 한국 → 독일(유라시아 위로)
  `M${toX(-98)} ${toY(39)} Q${toX(-48)} ${toY(70)} ${toX(-2)} ${toY(54)}`, // 미국 → 영국(대서양 위로)
  `M${toX(138)} ${toY(36)} Q${toX(165)} ${toY(62)} ${toX(180)} ${toY(50)}`, // 일본 → 태평양 건너 오른쪽 끝
  `M${toX(-180)} ${toY(50)} Q${toX(-150)} ${toY(62)} ${toX(-98)} ${toY(39)}`, // 왼쪽 끝 → 미국
];

export default function WorldMap({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id="map-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="url(#map-glow)" />

      {/* 대륙: 점으로 찍은 지도 */}
      <path d={DOT_PATH} stroke="#b6ccf5" strokeOpacity="0.8" strokeWidth="3.4" strokeLinecap="round" fill="none" />

      {/* 나라 사이를 잇는 곡선 */}
      {ARCS.map((d) => (
        <path key={d} d={d} className="map-arc" stroke="#fcd34d" strokeOpacity="0.9" strokeWidth="1.8" strokeDasharray="5 6" fill="none" />
      ))}

      {/* 지원하는 6개국 표시 */}
      {MARKERS.map((m) => {
        const x = toX(m.lon);
        const y = toY(m.lat);
        return (
          <g key={m.code}>
            <circle cx={x} cy={y} r="5.5" className="map-pulse" fill="none" stroke="#fcd34d" strokeWidth="1.8" />
            <circle cx={x} cy={y} r="4.6" fill="#fcd34d" stroke="#0b1d44" strokeWidth="1.2" />
            <text
              x={x + m.dx}
              y={y + m.dy}
              textAnchor={m.anchor}
              fill="#ffffff"
              fillOpacity="0.9"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.6"
              className="hidden sm:block"
            >
              {m.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
