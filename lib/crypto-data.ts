// Design Ref: §11.2 — 가상자산 자료 한 건의 모양과 검사 규칙
// Plan SC: 10개국 × 8개 항목, 모든 값에 출처(기관·URL·기준일)와 상태(시행 중/시행 예정/논의 중)를 붙인다
// 세율 자료(lib/tax-data.ts)와 따로 둔다: 한쪽 오류가 다른 쪽으로 번지지 않게 하기 위함

import rawCryptoData from "../data/crypto-data.json";

// ── 자료의 모양 ──────────────────────────────────────────────

// 가상자산 비교 대상 국가 (PRD 10.2: 세율 비교의 6개국 + 싱가포르, 호주, 캐나다, 스위스)
export const CRYPTO_COUNTRIES = ["KR", "US", "JP", "GB", "DE", "FR", "SG", "AU", "CA", "CH"] as const;
export type CryptoCountry = (typeof CRYPTO_COUNTRIES)[number];

// 비교 항목 (PRD 10.3). 앞의 4개가 핵심이고 화면에서 먼저 보여 준다.
export const CRYPTO_TOPICS = [
  "rate",
  "allowance",
  "taxType",
  "lossCarryover",
  "holdingPeriod",
  "miningStaking",
  "giftInheritance",
  "reporting",
] as const;
export type CryptoTopic = (typeof CRYPTO_TOPICS)[number];

// 처음 선택돼 있는 핵심 항목 4개
export const CORE_CRYPTO_TOPICS: readonly CryptoTopic[] = CRYPTO_TOPICS.slice(0, 4);

// 규정의 상태: 시행 중 / 시행 예정 / 논의 중
export const CRYPTO_STATUSES = ["in_force", "scheduled", "proposed"] as const;
export type CryptoStatus = (typeof CRYPTO_STATUSES)[number];

// 출처: 세 가지 중 하나라도 비면 자료로 등록하지 않는다
export type CryptoSource = {
  org: string; // 기관명
  url: string; // 자료 주소 (https)
  asOf: string; // 기준일 (YYYY-MM-DD)
};

// 가상자산 규정 한 건 (개인 거주자 기준)
export type CryptoRule = {
  country: CryptoCountry;
  topic: CryptoTopic;
  headline: string; // 표에 크게 보여 줄 짧은 값 (예: "22%", "연 250만 원", "분리과세")
  detail: string; // 조건 설명 (한두 문장). 한 줄로 줄일 수 없으면 headline을 "조건에 따라 다름"으로 쓴다
  status: CryptoStatus;
  effectiveFrom?: string; // 시행일(YYYY-MM-DD). 시행 예정(scheduled)이면 필수
  source: CryptoSource;
};

// ── 화면에 보여 줄 한국어 이름 ───────────────────────────────

export const CRYPTO_COUNTRY_LABELS: Record<CryptoCountry, string> = {
  KR: "한국",
  US: "미국",
  JP: "일본",
  GB: "영국",
  DE: "독일",
  FR: "프랑스",
  SG: "싱가포르",
  AU: "호주",
  CA: "캐나다",
  CH: "스위스",
};

export const CRYPTO_TOPIC_LABELS: Record<CryptoTopic, string> = {
  rate: "세율",
  allowance: "기본공제",
  taxType: "소득 구분",
  lossCarryover: "손실 이월공제",
  holdingPeriod: "보유기간 우대",
  miningStaking: "채굴·스테이킹",
  giftInheritance: "증여·상속",
  reporting: "거래소 정보 보고",
};

export const CRYPTO_STATUS_LABELS: Record<CryptoStatus, string> = {
  in_force: "시행 중",
  scheduled: "시행 예정",
  proposed: "논의 중",
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

function isFilledText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// 자료 한 건을 검사한다. 어긋나면 어느 번째 자료가 왜 틀렸는지 알려 주는 오류를 낸다.
function parseCryptoRule(raw: unknown, index: number): CryptoRule {
  const where = `가상자산 자료 ${index + 1}번째`;
  if (typeof raw !== "object" || raw === null) throw new Error(`${where}: 객체가 아님`);
  const r = raw as Record<string, unknown>;

  if (!isOneOf(CRYPTO_COUNTRIES, r.country)) throw new Error(`${where}: 지원하지 않는 국가 (${String(r.country)})`);
  if (!isOneOf(CRYPTO_TOPICS, r.topic)) throw new Error(`${where}: 지원하지 않는 항목 (${String(r.topic)})`);
  if (!isOneOf(CRYPTO_STATUSES, r.status)) throw new Error(`${where}: 알 수 없는 상태 (${String(r.status)})`);
  if (!isFilledText(r.headline)) throw new Error(`${where}: 짧은 값(headline)이 비어 있음`);
  if (!isFilledText(r.detail)) throw new Error(`${where}: 조건 설명(detail)이 비어 있음`);

  if (r.effectiveFrom !== undefined && (typeof r.effectiveFrom !== "string" || !isRealDate(r.effectiveFrom))) {
    throw new Error(`${where}: 시행일은 실제 날짜(YYYY-MM-DD)여야 함`);
  }
  if (r.status === "scheduled" && r.effectiveFrom === undefined) {
    throw new Error(`${where}: 시행 예정 자료에는 시행일(effectiveFrom)이 필요함`);
  }

  const source = r.source as Record<string, unknown> | undefined;
  if (typeof source !== "object" || source === null) throw new Error(`${where}: 출처가 없음`);
  if (!isFilledText(source.org)) throw new Error(`${where}: 출처 기관명이 없음`);
  if (typeof source.url !== "string" || !/^https:\/\/\S+$/.test(source.url)) {
    throw new Error(`${where}: 출처 URL은 https:// 주소여야 함`);
  }
  if (typeof source.asOf !== "string" || !isRealDate(source.asOf)) {
    throw new Error(`${where}: 기준일은 실제 날짜(YYYY-MM-DD)여야 함`);
  }

  return {
    country: r.country,
    topic: r.topic,
    headline: r.headline,
    detail: r.detail,
    status: r.status,
    effectiveFrom: r.effectiveFrom as string | undefined,
    source: { org: source.org, url: source.url, asOf: source.asOf },
  };
}

// 자료 목록 전체를 검사한다. 같은 자료가 두 번 들어 있어도 오류로 본다.
// 같은 나라·항목에 현행 규정과 시행 예정 규정이 함께 있을 수 있어, 상태까지 같아야 중복으로 본다.
export function parseCryptoData(raw: unknown): CryptoRule[] {
  if (!Array.isArray(raw)) throw new Error("가상자산 자료는 목록이어야 함");
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const rule = parseCryptoRule(entry, index);
    const key = [rule.country, rule.topic, rule.status, rule.source.url].join("|");
    if (seen.has(key)) throw new Error(`가상자산 자료 ${index + 1}번째: 같은 자료가 중복됨`);
    seen.add(key);
    return rule;
  });
}

// 등록된 자료. 파일이 틀리면 여기서 바로 오류가 나서 빌드가 멈춘다.
export const CRYPTO_DATA: readonly CryptoRule[] = parseCryptoData(rawCryptoData);

// ── 조회 ────────────────────────────────────────────────────

// 같은 칸에 자료가 여럿일 때 보여 줄 순서: 시행 중 → 시행 예정 → 논의 중, 같은 상태면 기준일이 최근인 것 먼저
const STATUS_ORDER: Record<CryptoStatus, number> = { in_force: 0, scheduled: 1, proposed: 2 };

// 국가와 항목에 해당하는 자료를 모두 돌려준다. 등록된 자료가 없으면 빈 목록이다.
// (화면에서는 "해당 자료를 찾지 못했습니다"로 표시)
export function getCryptoRules(
  country: CryptoCountry,
  topic: CryptoTopic,
  data: readonly CryptoRule[] = CRYPTO_DATA,
): CryptoRule[] {
  return data
    .filter((r) => r.country === country && r.topic === topic)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.source.asOf.localeCompare(a.source.asOf),
    );
}

// ── 지원 목록 ───────────────────────────────────────────────

export function isSupportedCryptoCountry(code: string): code is CryptoCountry {
  return isOneOf(CRYPTO_COUNTRIES, code);
}

export function isSupportedCryptoTopic(code: string): code is CryptoTopic {
  return isOneOf(CRYPTO_TOPICS, code);
}

// 지원하는 국가와 항목 목록 (지원하지 않는 국가·항목을 골랐을 때 안내용)
export function getCryptoSupportedList() {
  return {
    countries: CRYPTO_COUNTRIES.map((code) => ({ code, label: CRYPTO_COUNTRY_LABELS[code] })),
    topics: CRYPTO_TOPICS.map((code) => ({ code, label: CRYPTO_TOPIC_LABELS[code] })),
  };
}

// ── 오래된 자료·상태 판별 ───────────────────────────────────

// 기준일이 오늘보다 이 날수 넘게 지났으면 "오래된 자료"로 본다. (세율 자료와 같은 기준이지만 값은 따로 둔다)
export const CRYPTO_OUTDATED_AFTER_DAYS = 365;

export function isCryptoOutdated(rule: CryptoRule, today: Date = new Date()): boolean {
  const asOf = new Date(`${rule.source.asOf}T00:00:00Z`);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((todayUtc - asOf.getTime()) / 86_400_000);
  return days > CRYPTO_OUTDATED_AFTER_DAYS;
}

// 시행 예정이거나 논의 중인 규정인지 ("※ 아직 시행 전" 안내를 붙일 때 쓴다)
export function isNotYetInForce(rule: CryptoRule): boolean {
  return rule.status !== "in_force";
}

// 자료 묶음 중 하나라도 시행 전(시행 예정·논의 중)이면 true
export function hasNotYetInForce(rules: readonly CryptoRule[]): boolean {
  return rules.some(isNotYetInForce);
}
