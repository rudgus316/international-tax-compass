// Design Ref: §3.3 — 자료 한 건의 모양
// Plan SC: 모든 값에 출처(기관·URL·기준일)를 붙인다 (출처 표시율 100%)

// 지원하는 국가 (PRD 6번: 한국, 미국, 일본, 영국, 독일, 프랑스)
export const COUNTRIES = ["KR", "US", "JP", "GB", "DE", "FR"] as const;
export type Country = (typeof COUNTRIES)[number];

// 지원하는 항목 (PRD 6번: 법인세율, 배당·이자·로열티 원천세율)
export const ITEMS = ["corporate", "dividend", "interest", "royalty"] as const;
export type Item = (typeof ITEMS)[number];

// 세율 종류
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
