// 비교표 한 칸에 들어가는 가상자산 규정 목록.
// 규정마다 상태 배지(시행 중/시행 예정/논의 중), 값(크게), 조건 설명(작게), 출처 링크, 기준일, "오래된 자료"를 보여 준다.
// Plan SC: 값의 100%에 기관명·링크·기준일·상태를 표시한다. 기준일이 1년 넘으면 "오래된 자료"를 표시한다.

import { CRYPTO_STATUS_LABELS, isCryptoOutdated, type CryptoRule, type CryptoStatus } from "@/lib/crypto-data";

// 상태 배지 색: 시행 중은 회색, 시행 예정은 노랑, 논의 중은 주황 (색만으로 구분하지 않도록 글자도 함께 쓴다)
const STATUS_BADGE_STYLES: Record<CryptoStatus, string> = {
  in_force: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
  scheduled: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100",
  proposed: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
};

export default function CryptoRuleList({ rules }: { rules: readonly CryptoRule[] }) {
  return (
    <ul className="flex max-w-72 flex-col gap-3">
      {rules.map((rule) => (
        <li key={`${rule.status}-${rule.source.url}-${rule.headline}`} className="flex flex-col gap-1">
          <span className={`w-fit rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[rule.status]}`}>
            {CRYPTO_STATUS_LABELS[rule.status]}
            {rule.effectiveFrom && rule.status === "scheduled" && ` (${rule.effectiveFrom} 시행)`}
          </span>
          <span className="text-lg font-semibold">{rule.headline}</span>
          <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{rule.detail}</span>
          {/* 출처: 기관명(자료 주소로 연결)과 기준일. 모든 값에 반드시 붙는다 */}
          <a
            href={rule.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-700 underline underline-offset-2 dark:text-blue-300"
          >
            {rule.source.org}
            <span className="sr-only"> (새 창에서 열림)</span>
          </a>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            기준일 {rule.source.asOf}
            {isCryptoOutdated(rule) && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                오래된 자료
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
