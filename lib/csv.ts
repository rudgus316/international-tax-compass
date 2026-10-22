// Plan: 작업 18, 32 (nice) — 비교표를 엑셀(CSV)로 내려받기. PRD 5번 nice 기능.
// 작업 32: 가상자산 항목도 같은 파일에 담는다. 앞의 10칸은 세율 CSV와 같고, 뒤에 분야·상태·시행일 3칸을 더했다.
// 한 행에 값 하나(국가·항목·세율 종류)를 담는 "긴 표" 모양이라 엑셀에서 정렬·필터하기 쉽다.
// 화면의 비교표와 같은 내용(값, 출처, 기준일, 오래된 자료, 자료 간 차이, 해당 없음, 자료 없음)을 담고, 메모(조건)도 함께 넣는다.

import {
  CRYPTO_COUNTRY_LABELS,
  CRYPTO_STATUS_LABELS,
  CRYPTO_TOPIC_LABELS,
  getCryptoRules,
  isCryptoOutdated,
  type CryptoCountry,
  type CryptoTopic,
} from "./crypto-data";
import {
  ITEM_LABELS,
  RATE_TYPE_LABELS,
  getValues,
  hasConflict,
  isNotApplicable,
  isOutdated,
  isSupportedCountry,
  type Item,
  type TaxValue,
} from "./tax-data";

// 값 칸: 세율 자료는 퍼센트 숫자, 가상자산은 짧은 값(headline)이 들어간다. 메모 칸: 세율은 조건 메모, 가상자산은 조건 설명(detail).
export const CSV_HEADER = [
  "국가", "항목", "세율 종류", "값(세율은 %)", "출처 기관", "출처 링크", "기준일", "오래된 자료", "자료 간 차이", "메모·설명",
  "분야", "상태", "시행일",
];
const FIELD_TAX = "세율";
const FIELD_CRYPTO = "가상자산";

// 글자 하나를 CSV 칸으로 바꾼다.
// - 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고, 안의 따옴표는 두 번 쓴다.
// - =, +, -, @ 로 시작하는 글은 엑셀이 수식으로 실행하지 못하게 앞에 '를 붙인다.
function cell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function row(columns: string[]): string {
  return columns.map(cell).join(",");
}

// 같은 세율 종류에 값이 다른 자료가 둘 이상인 묶음
function conflictingKeys(values: readonly TaxValue[]): Set<string> {
  const groups = new Map<string, TaxValue[]>();
  for (const v of values) {
    const key = `${v.rateType}|${v.partnerCountry ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  return new Set([...groups].filter(([, group]) => hasConflict(group)).map(([key]) => key));
}

// 고른 국가와 항목의 비교표를 CSV 글로 만든다. 줄 끝은 엑셀에 맞춰 \r\n이다.
export function buildCompareCsv(
  countries: readonly CryptoCountry[],
  items: readonly Item[],
  today: Date = new Date(),
  topics: readonly CryptoTopic[] = [],
): string {
  const lines: string[] = [row(CSV_HEADER)];
  const label = (country: CryptoCountry) => CRYPTO_COUNTRY_LABELS[country];

  for (const item of items) {
    for (const country of countries) {
      // 세율 비교는 6개국만 지원한다 (화면과 같이 "현재 지원하지 않습니다"로 적는다)
      if (!isSupportedCountry(country)) {
        lines.push(row([label(country), ITEM_LABELS[item], "", "현재 지원하지 않습니다", "", "", "", "", "", "", FIELD_TAX, "", ""]));
        continue;
      }
      const values = getValues(country, item);
      const conflicts = conflictingKeys(values);
      const treatyNotApplicable = item !== "corporate" && isNotApplicable(country, "treaty");

      if (values.length === 0 && !treatyNotApplicable) {
        lines.push(row([label(country), ITEM_LABELS[item], "", "해당 자료를 찾지 못했습니다", "", "", "", "", "", "", FIELD_TAX, "", ""]));
        continue;
      }
      for (const v of values) {
        lines.push(
          row([
            label(country),
            ITEM_LABELS[item],
            RATE_TYPE_LABELS[v.rateType],
            String(v.value),
            v.source.org,
            v.source.url,
            v.source.asOf,
            isOutdated(v, today) ? "예" : "",
            conflicts.has(`${v.rateType}|${v.partnerCountry ?? ""}`) ? "예" : "",
            v.note ?? "",
            FIELD_TAX,
            "",
            "",
          ]),
        );
      }
      if (treatyNotApplicable) {
        lines.push(row([label(country), ITEM_LABELS[item], RATE_TYPE_LABELS.treaty, "해당 없음(기준국)", "", "", "", "", "", "", FIELD_TAX, "", ""]));
      }
    }
  }

  // 가상자산 항목: 한 행에 규정 하나. 같은 칸에 규정이 여럿이면(현행·시행 예정 등) 모두 적는다.
  for (const topic of topics) {
    for (const country of countries) {
      const rules = getCryptoRules(country, topic);
      if (rules.length === 0) {
        lines.push(row([label(country), CRYPTO_TOPIC_LABELS[topic], "", "해당 자료를 찾지 못했습니다", "", "", "", "", "", "", FIELD_CRYPTO, "", ""]));
        continue;
      }
      for (const r of rules) {
        lines.push(
          row([
            label(country),
            CRYPTO_TOPIC_LABELS[topic],
            "",
            r.headline,
            r.source.org,
            r.source.url,
            r.source.asOf,
            isCryptoOutdated(r, today) ? "예" : "",
            "",
            r.detail,
            FIELD_CRYPTO,
            CRYPTO_STATUS_LABELS[r.status],
            r.effectiveFrom ?? "",
          ]),
        );
      }
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

// 내려받는 파일 이름. 예: 국제조세_비교표_2026-10-22.csv
export function csvFileName(today: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `국제조세_비교표_${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.csv`;
}
