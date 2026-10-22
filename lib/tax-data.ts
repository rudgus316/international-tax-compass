// Design Ref: §3.3 — 자료 한 건의 모양, §5 — lib/tax-data.ts (자료 조회, 지원 목록, 1년 초과 판별)
// Plan SC: 모든 값에 출처(기관·URL·기준일)를 붙인다 (출처 표시율 100%)

import rawTaxData from "../data/tax-data.json";

// ── 자료의 모양 ──────────────────────────────────────────────

// 지원하는 국가 (PRD 6번: 한국, 미국, 일본, 영국, 독일, 프랑스)
export const COUNTRIES = ["KR", "US", "JP", "GB", "DE", "FR"] as const;
export type Country = (typeof COUNTRIES)[number];

// 지원하는 항목 (PRD 6번: 법인세율, 배당·이자·로열티 원천세율)
export const ITEMS = ["corporate", "dividend", "interest", "royalty"] as const;
export type Item = (typeof ITEMS)[number];

// 세율 종류 (화면에 보여 줄 순서이기도 함)
// - statutory: 최고세율, combined: 지방세 포함 합산 (법인세율용)
// - domestic: 국내법 세율, treaty: 조세조약 적용 세율 (원천세율용)
export const RATE_TYPES = ["statutory", "combined", "domestic", "treaty"] as const;
export type RateType = (typeof RATE_TYPES)[number];

// 출처: 세 가지 중 하나라도 비면 자료로 등록하지 않는다
export type TaxSource = {
  org: string; // 기관명
  url: string; // 자료 주소
  asOf: string; // 기준일 (YYYY-MM-DD)
};

// 조세 자료 한 건
export type TaxValue = {
  country: Country;
  item: Item;
  rateType: RateType;
  partnerCountry?: Country; // 조약(treaty)일 때만 필수: 기준 상대국. 한국 거주자 기준이라 항상 "KR"
  value: number; // 퍼센트 (예: 21은 21%)
  note?: string; // 조건 (예: 지분율 요건)
  source: TaxSource;
};

// ── 화면에 보여 줄 한국어 이름 ───────────────────────────────

export const COUNTRY_LABELS: Record<Country, string> = {
  KR: "한국",
  US: "미국",
  JP: "일본",
  GB: "영국",
  DE: "독일",
  FR: "프랑스",
};

export const ITEM_LABELS: Record<Item, string> = {
  corporate: "법인세율",
  dividend: "배당 원천세율",
  interest: "이자 원천세율",
  royalty: "로열티 원천세율",
};

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  statutory: "최고세율",
  combined: "지방세 포함 합산",
  domestic: "국내법",
  treaty: "조세조약(한국 거주자 기준)",
};

// ── 자료 검사 (등록된 JSON이 약속한 모양인지 확인) ───────────

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// 자료 한 건을 검사한다. 어긋나면 어느 번째 자료가 왜 틀렸는지 알려 주는 오류를 낸다.
function parseTaxValue(raw: unknown, index: number): TaxValue {
  const where = `조세 자료 ${index + 1}번째`;
  if (typeof raw !== "object" || raw === null) throw new Error(`${where}: 객체가 아님`);
  const r = raw as Record<string, unknown>;

  if (!isOneOf(COUNTRIES, r.country)) throw new Error(`${where}: 지원하지 않는 국가 (${String(r.country)})`);
  if (!isOneOf(ITEMS, r.item)) throw new Error(`${where}: 지원하지 않는 항목 (${String(r.item)})`);
  if (!isOneOf(RATE_TYPES, r.rateType)) throw new Error(`${where}: 알 수 없는 세율 종류 (${String(r.rateType)})`);
  if (typeof r.value !== "number" || !Number.isFinite(r.value) || r.value < 0 || r.value > 100) {
    throw new Error(`${where}: 값은 0~100 사이 숫자여야 함`);
  }

  const source = r.source as Record<string, unknown> | undefined;
  if (typeof source !== "object" || source === null) throw new Error(`${where}: 출처가 없음`);
  if (typeof source.org !== "string" || source.org.trim() === "") throw new Error(`${where}: 출처 기관명이 없음`);
  if (typeof source.url !== "string" || !/^https:\/\/\S+$/.test(source.url)) {
    throw new Error(`${where}: 출처 URL은 https:// 주소여야 함`);
  }
  if (typeof source.asOf !== "string" || !isRealDate(source.asOf)) {
    throw new Error(`${where}: 기준일은 실제 날짜(YYYY-MM-DD)여야 함`);
  }

  if (r.rateType === "treaty") {
    if (r.partnerCountry !== "KR") throw new Error(`${where}: 조약 자료의 상대국(partnerCountry)은 KR이어야 함`);
    if (r.country === "KR") throw new Error(`${where}: 한국의 조약 자료는 만들지 않음(기준국)`);
  } else if (r.partnerCountry !== undefined) {
    throw new Error(`${where}: 조약이 아닌 자료에는 상대국을 적지 않음`);
  }

  if (r.note !== undefined && typeof r.note !== "string") throw new Error(`${where}: 메모는 글자여야 함`);

  return {
    country: r.country,
    item: r.item,
    rateType: r.rateType,
    partnerCountry: r.partnerCountry === "KR" ? "KR" : undefined,
    value: r.value,
    note: r.note,
    source: { org: source.org, url: source.url, asOf: source.asOf },
  };
}

// 자료 목록 전체를 검사한다. 같은 자료가 두 번 들어 있어도 오류로 본다.
export function parseTaxData(raw: unknown): TaxValue[] {
  if (!Array.isArray(raw)) throw new Error("조세 자료는 목록이어야 함");
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const value = parseTaxValue(entry, index);
    const key = [value.country, value.item, value.rateType, value.source.url].join("|");
    if (seen.has(key)) throw new Error(`조세 자료 ${index + 1}번째: 같은 자료가 중복됨`);
    seen.add(key);
    return value;
  });
}

// 등록된 자료. 파일이 틀리면 여기서 바로 오류가 나서 빌드가 멈춘다.
export const TAX_DATA: readonly TaxValue[] = parseTaxData(rawTaxData);

// ── 조회 ────────────────────────────────────────────────────

// 국가와 항목에 해당하는 자료를 세율 종류 순서(최고→합산→국내법→조약)로 돌려준다.
// 등록된 자료가 없으면 빈 목록이다. (화면에서는 "해당 자료를 찾지 못했습니다"로 표시)
export function getValues(country: Country, item: Item, data: readonly TaxValue[] = TAX_DATA): TaxValue[] {
  return data
    .filter((v) => v.country === country && v.item === item)
    .sort((a, b) => RATE_TYPES.indexOf(a.rateType) - RATE_TYPES.indexOf(b.rateType));
}

// 이 국가의 이 세율 종류가 "해당 없음"인지 (한국의 조약 세율은 기준국이라 해당 없음)
export function isNotApplicable(country: Country, rateType: RateType): boolean {
  return country === "KR" && rateType === "treaty";
}

// 같은 세율 종류에 값이 다른 자료가 둘 이상이면 true ("자료 간 차이 있음" 표시용)
export function hasConflict(values: readonly TaxValue[]): boolean {
  const byType = new Map<string, Set<number>>();
  for (const v of values) {
    const key = `${v.rateType}|${v.partnerCountry ?? ""}`;
    const set = byType.get(key) ?? new Set<number>();
    set.add(v.value);
    byType.set(key, set);
  }
  return [...byType.values()].some((set) => set.size > 1);
}

// ── 지원 목록 ───────────────────────────────────────────────

export function isSupportedCountry(code: string): code is Country {
  return isOneOf(COUNTRIES, code);
}

export function isSupportedItem(code: string): code is Item {
  return isOneOf(ITEMS, code);
}

// 지원하는 국가와 항목 목록 (지원하지 않는 국가·항목을 골랐을 때 안내용)
export function getSupportedList() {
  return {
    countries: COUNTRIES.map((code) => ({ code, label: COUNTRY_LABELS[code] })),
    items: ITEMS.map((code) => ({ code, label: ITEM_LABELS[code] })),
  };
}

// ── 오래된 자료 판별 ────────────────────────────────────────

// 기준일이 오늘보다 며칠 전인지 센다. 이 날수를 넘으면 "오래된 자료"로 본다.
export const OUTDATED_AFTER_DAYS = 365;

export function isOutdated(value: TaxValue, today: Date = new Date()): boolean {
  const asOf = new Date(`${value.source.asOf}T00:00:00Z`);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((todayUtc - asOf.getTime()) / 86_400_000);
  return days > OUTDATED_AFTER_DAYS;
}
