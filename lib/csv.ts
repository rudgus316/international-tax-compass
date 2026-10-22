// Plan: 작업 18 (nice) — 비교표를 엑셀(CSV)로 내려받기. PRD 5번 nice 기능.
// 한 행에 값 하나(국가·항목·세율 종류)를 담는 "긴 표" 모양이라 엑셀에서 정렬·필터하기 쉽다.
// 화면의 비교표와 같은 내용(값, 출처, 기준일, 오래된 자료, 자료 간 차이, 해당 없음, 자료 없음)을 담고, 메모(조건)도 함께 넣는다.

import {
  COUNTRY_LABELS,
  ITEM_LABELS,
  RATE_TYPE_LABELS,
  getValues,
  hasConflict,
  isNotApplicable,
  isOutdated,
  type Country,
  type Item,
  type TaxValue,
} from "./tax-data";

export const CSV_HEADER = ["국가", "항목", "세율 종류", "값(%)", "출처 기관", "출처 링크", "기준일", "오래된 자료", "자료 간 차이", "메모"];

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
export function buildCompareCsv(countries: readonly Country[], items: readonly Item[], today: Date = new Date()): string {
  const lines: string[] = [row(CSV_HEADER)];

  for (const item of items) {
    for (const country of countries) {
      const values = getValues(country, item);
      const conflicts = conflictingKeys(values);
      const treatyNotApplicable = item !== "corporate" && isNotApplicable(country, "treaty");

      if (values.length === 0 && !treatyNotApplicable) {
        lines.push(row([COUNTRY_LABELS[country], ITEM_LABELS[item], "", "해당 자료를 찾지 못했습니다", "", "", "", "", "", ""]));
        continue;
      }
      for (const v of values) {
        lines.push(
          row([
            COUNTRY_LABELS[country],
            ITEM_LABELS[item],
            RATE_TYPE_LABELS[v.rateType],
            String(v.value),
            v.source.org,
            v.source.url,
            v.source.asOf,
            isOutdated(v, today) ? "예" : "",
            conflicts.has(`${v.rateType}|${v.partnerCountry ?? ""}`) ? "예" : "",
            v.note ?? "",
          ]),
        );
      }
      if (treatyNotApplicable) {
        lines.push(row([COUNTRY_LABELS[country], ITEM_LABELS[item], RATE_TYPE_LABELS.treaty, "해당 없음(기준국)", "", "", "", "", "", ""]));
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
