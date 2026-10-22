// 앱 이름에 맞춘 나침반 모양 로고. 장식이라 읽어 주는 프로그램은 건너뛴다.
export default function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <circle cx="24" cy="24" r="21" fill="#0b1d44" fillOpacity="0.55" stroke="#fcd34d" strokeWidth="2" />
      {/* 동서남북 눈금 */}
      <g stroke="#fcd34d" strokeWidth="2" strokeLinecap="round">
        <path d="M24 5v4M24 39v4M5 24h4M39 24h4" />
      </g>
      {/* 바늘: 북쪽은 금색, 남쪽은 흰색 */}
      <path d="M24 10 L29 24 L24 24 Z" fill="#fcd34d" />
      <path d="M24 10 L19 24 L24 24 Z" fill="#f59e0b" />
      <path d="M24 38 L19 24 L24 24 Z" fill="#ffffff" fillOpacity="0.9" />
      <path d="M24 38 L29 24 L24 24 Z" fill="#cbd5e1" />
      <circle cx="24" cy="24" r="2.2" fill="#0b1d44" stroke="#fcd34d" strokeWidth="1" />
    </svg>
  );
}
