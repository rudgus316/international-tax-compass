// Design Ref: §11.4 — 질문 검색의 가상자산 부분: 가상자산 질문 알아보기, 국가·항목 찾기, 투자 권유 거절.
// Plan SC: 가상자산 질문도 등록된 자료 안에서만 답하고, 투자 권유·매매 조언은 하지 않는다.

import {
  CRYPTO_COUNTRIES,
  CRYPTO_DATA,
  CRYPTO_TOPICS,
  type CryptoCountry,
  type CryptoRule,
  type CryptoTopic,
} from "./crypto-data";

// 가상자산 질문임을 알려 주는 말 (소문자로 바꾼 질문에서 찾는다)
export const CRYPTO_WORDS = [
  "가상자산", "암호화폐", "암호 화폐", "가상화폐", "디지털자산", "디지털 자산", "코인", "비트코인", "이더리움", "리플",
  "스테이킹", "채굴", "크립토", "에어드롭", "crypto", "bitcoin", "ethereum", "staking", "carf", "dac8",
];

const COUNTRY_ALIASES: Record<CryptoCountry, string[]> = {
  KR: ["한국", "대한민국", "우리나라", "korea"],
  US: ["미국", "usa", "united states"],
  JP: ["일본", "japan"],
  GB: ["영국", "united kingdom"],
  DE: ["독일", "germany"],
  FR: ["프랑스", "france"],
  SG: ["싱가포르", "singapore"],
  AU: ["호주", "오스트레일리아", "australia"],
  CA: ["캐나다", "canada"],
  CH: ["스위스", "switzerland"],
};

// 항목별로 질문에서 찾을 말. 가상자산 질문일 때만 쓴다.
const TOPIC_ALIASES: Record<CryptoTopic, string[]> = {
  rate: ["세율", "세금률", "몇 %", "몇%", "퍼센트"],
  allowance: ["기본공제", "면제 한도", "면제한도", "비과세 한도", "과세최저한", "250만", "공제"],
  taxType: [
    "종합과세", "분리과세", "분류과세", "소득 구분", "소득구분", "과세 방식", "어떤 소득", "기타소득", "잡소득", "자본이득",
    "양도소득", "사업소득", "어떻게 과세", "어떻게 세금",
  ],
  lossCarryover: ["이월", "손실", "결손"],
  holdingPeriod: ["보유기간", "보유 기간", "장기 보유", "장기보유", "1년 보유", "1년 이상", "1년 넘", "1년 초과", "12개월", "오래 보유", "보유하면"],
  miningStaking: ["채굴", "스테이킹", "staking", "mining", "에어드롭"],
  giftInheritance: ["증여", "상속"],
  reporting: ["정보 보고", "거래소 보고", "신고 의무", "보고 의무", "정보 교환", "carf", "dac8", "t1135", "거래소 신고", "보고"],
};

// 투자 권유·매매 조언·어느 나라가 유리한지를 묻는 말. 이런 질문은 AI를 부르지 않고 거절한다.
export const ADVICE_PATTERNS: RegExp[] = [
  /어(느|디)\s*(나라|국가|곳).{0,15}(유리|좋|낫|추천|이득|저렴|싸)/,
  /(나라|국가)(를|을|로)?\s*(추천|골라|정해)/,
  /추천/,
  /유리(한|할|해|하|함|하다)/,
  /(사야|팔아야|사도\s*(돼|되)|살까|팔까|투자\s*(해야|할까|해도\s*(돼|되)|조언|전략|권유|가치))/,
  /(매수|매도).{0,6}(해야|할까|타이밍|시점|좋)/,
];

export const ADVICE_MESSAGE = "투자 권유나 어느 나라가 유리한지는 알려 드릴 수 없습니다. 나라별 규정 비교만 보여 드릴 수 있습니다";

function mentions(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

// 가상자산에 대한 질문인지
export function isCryptoQuestion(question: string): boolean {
  return mentions(question.toLowerCase(), CRYPTO_WORDS);
}

// 한 번에 AI에 보낼 규정 수의 상한 (글이 너무 길어지면 비용과 정확도가 나빠진다)
const MAX_RULES = 30;

// 질문에서 국가와 항목을 찾아 가상자산 규정을 고른다.
// 국가도 항목도 못 찾으면 빈 결과다. 한쪽만 찾으면 다른 쪽은 전체를 쓴다.
export function pickCryptoRules(question: string): { rules: CryptoRule[]; askedCountries: CryptoCountry[] } {
  const text = question.toLowerCase();
  const askedCountries = CRYPTO_COUNTRIES.filter((c) => mentions(text, COUNTRY_ALIASES[c]));

  // "손실 이월공제"의 "공제"가 기본공제로 잘못 잡히지 않게, 이월공제는 지우고 기본공제 말을 찾는다
  const textForAllowance = text.replace(/이월\s*공제/g, "");
  const askedTopics = CRYPTO_TOPICS.filter((t) => mentions(t === "allowance" ? textForAllowance : text, TOPIC_ALIASES[t]));

  if (askedCountries.length === 0 && askedTopics.length === 0) return { rules: [], askedCountries };

  const useCountries = askedCountries.length > 0 ? askedCountries : CRYPTO_COUNTRIES;
  const useTopics = askedTopics.length > 0 ? askedTopics : CRYPTO_TOPICS;
  const rules = CRYPTO_DATA.filter((r) => useCountries.includes(r.country) && useTopics.includes(r.topic)).slice(0, MAX_RULES);
  return { rules, askedCountries };
}
