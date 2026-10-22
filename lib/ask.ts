// Design Ref: §3.2 ②~④⑦ — 질문 처리: 서버 검사, 질문 분류, 관련 자료 고르기, 공통 마무리.
// 이번 작업에서는 OpenAI를 부르지 않는다. 자료가 있으면 등록된 값을 그대로 정리해 답으로 돌려주고,
// 이후 작업(OpenAI 연결, 답변 규칙)에서 이 자리를 AI 답변으로 바꾼다.
// Plan SC: 지원 밖·세액 계산·자료 없음·개인정보 응답에도 면책 문구를 붙인다. 답변은 500자 이내.

import { MAX_QUESTION_LENGTH, detectPii } from "./pii";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  ITEMS,
  ITEM_LABELS,
  RATE_TYPE_LABELS,
  TAX_DATA,
  getSupportedList,
  isOutdated,
  type Country,
  type Item,
  type TaxSource,
  type TaxValue,
} from "./tax-data";

export const DISCLAIMER = "참고용이며 세무 자문이 아닙니다";
export const MAX_ANSWER_LENGTH = 500;

export type AskStatus = "ok" | "no_data" | "unsupported" | "refused" | "blocked" | "error";

export type AskResponse = {
  status: AskStatus;
  answer: string;
  sources: TaxSource[];
  supported?: ReturnType<typeof getSupportedList>; // unsupported일 때만
};

// ── 질문 속 말 찾기 ─────────────────────────────────────────

const COUNTRY_ALIASES: Record<Country, string[]> = {
  KR: ["한국", "대한민국", "우리나라", "korea"],
  US: ["미국", "usa", "united states"],
  JP: ["일본", "japan"],
  GB: ["영국", "united kingdom"],
  DE: ["독일", "germany"],
  FR: ["프랑스", "france"],
};

const ITEM_ALIASES: Record<Item, string[]> = {
  corporate: ["법인세"],
  dividend: ["배당"],
  interest: ["이자"],
  royalty: ["로열티", "사용료", "특허료"],
};

// "원천세율"처럼 세 가지 원천세를 한꺼번에 가리키는 말
const WITHHOLDING_WORDS = ["원천세", "원천징수"];

// 지원하지 않는 국가와 항목 (모든 경우를 담을 수는 없어 자주 묻는 것만 둔다)
const UNSUPPORTED_COUNTRIES = [
  "중국", "캐나다", "호주", "인도", "싱가포르", "홍콩", "대만", "베트남", "태국", "인도네시아", "필리핀", "말레이시아",
  "러시아", "브라질", "멕시코", "이탈리아", "스페인", "네덜란드", "스위스", "스웨덴", "노르웨이", "아일랜드", "벨기에",
  "룩셈부르크", "폴란드", "터키", "튀르키예", "사우디", "이스라엘", "뉴질랜드", "아랍에미리트",
];
const UNSUPPORTED_ITEMS = [
  "부가가치세", "부가세", "vat", "양도소득세", "종합소득세", "근로소득세", "개인소득세", "상속세", "증여세", "관세",
  "종합부동산세", "재산세", "취득세", "소비세", "판매세",
];

// 세액 계산이나 절세 방법을 묻는 말
const REFUSE_PATTERNS: RegExp[] = [/세액/, /세금\s*계산/, /계산해/, /절세/, /탈세/, /세금을?\s*(줄|아끼)/, /(얼마|몇\s*원).{0,10}(내야|납부|내게)/];

function mentions(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

// 질문에서 국가와 항목을 찾아 관련 자료를 고른다. 찾는 말이 하나도 없으면 빈 결과다.
export function pickRelevantData(question: string): { values: TaxValue[]; askedCountries: Country[] } {
  const text = question.toLowerCase();
  const askedCountries = COUNTRIES.filter((c) => mentions(text, COUNTRY_ALIASES[c]));
  let askedItems = ITEMS.filter((i) => mentions(text, ITEM_ALIASES[i]));
  if (mentions(text, WITHHOLDING_WORDS)) {
    askedItems = ITEMS.filter((i) => askedItems.includes(i) || i === "dividend" || i === "interest" || i === "royalty");
  }
  if (askedCountries.length === 0 && askedItems.length === 0) return { values: [], askedCountries };

  const useCountries = askedCountries.length > 0 ? askedCountries : COUNTRIES;
  const useItems = askedItems.length > 0 ? askedItems : ITEMS;
  const values = TAX_DATA.filter((v) => useCountries.includes(v.country) && useItems.includes(v.item));
  return { values, askedCountries };
}

// ── 답 만들기 ───────────────────────────────────────────────

// 모든 응답의 마지막 단계: 어떤 status든 면책 문구를 붙인다
function finalize(status: AskStatus, message: string, sources: TaxSource[] = [], supported?: AskResponse["supported"]): AskResponse {
  return { status, answer: `${message}\n\n${DISCLAIMER}`, sources, ...(supported ? { supported } : {}) };
}

// 등록된 값을 국가·항목별 한 줄로 정리한다. 면책 문구를 포함해 500자를 넘지 않게 줄인다.
function buildAnswer(values: TaxValue[], askedCountries: Country[]): AskResponse {
  const lines: { text: string; values: TaxValue[] }[] = [];
  for (const country of COUNTRIES) {
    for (const item of ITEMS) {
      const cell = values.filter((v) => v.country === country && v.item === item);
      if (cell.length === 0) continue;
      const parts = cell.map((v) => `${RATE_TYPE_LABELS[v.rateType]} ${v.value}%${isOutdated(v) ? " (오래된 자료)" : ""}`);
      lines.push({ text: `${COUNTRY_LABELS[country]} ${ITEM_LABELS[item]}: ${parts.join(", ")}`, values: cell });
    }
  }
  // 질문에서 직접 물은 국가에 자료가 하나도 없으면 그 사실을 알려 준다
  for (const country of askedCountries) {
    if (!values.some((v) => v.country === country)) {
      lines.push({ text: `${COUNTRY_LABELS[country]}: 해당 자료를 찾지 못했습니다`, values: [] });
    }
  }

  const limit = MAX_ANSWER_LENGTH - (DISCLAIMER.length + 2); // 면책 문구가 들어갈 자리를 뺀 글자 수
  const NOTE = "…(길어서 일부만 표시했습니다)";
  const join = (list: typeof lines) => list.map((l) => l.text).join("\n");

  let shown = lines;
  let body = join(lines);
  if (body.length > limit) {
    // 줄 단위로 자른다. 숫자나 출처가 중간에 잘리지 않게 하고, 안내 문구가 들어갈 자리를 남긴다.
    shown = [];
    for (const line of lines) {
      const candidate = [...shown, line];
      if (join(candidate).length + 1 + NOTE.length > limit) break;
      shown = candidate;
    }
    body = shown.length > 0 ? `${join(shown)}\n${NOTE}` : NOTE;
  }

  const sources = uniqueSources(shown.flatMap((l) => l.values.map((v) => v.source)));
  return finalize("ok", body, sources);
}

function uniqueSources(list: TaxSource[]): TaxSource[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = `${s.org}|${s.url}|${s.asOf}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 질문 하나를 처리 ────────────────────────────────────────

export function answerQuestion(input: unknown): AskResponse {
  if (typeof input !== "string") return finalize("error", "질문을 읽을 수 없습니다");
  const question = input.trim();

  if (question === "") return finalize("error", "질문을 입력해 주세요");
  if (question.length > MAX_QUESTION_LENGTH) return finalize("error", `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요`);

  // 서버에서 2차 검사: 화면 검사를 믿지 않고 한 번 더 확인한다
  const pii = detectPii(question);
  if (pii.length > 0) return finalize("blocked", `개인정보로 보이는 내용이 있어 보낼 수 없습니다 (감지: ${pii.join(", ")})`);

  const text = question.toLowerCase();
  if (REFUSE_PATTERNS.some((pattern) => pattern.test(question))) {
    return finalize("refused", "세액 계산과 절세 자문은 제공하지 않습니다");
  }

  if (mentions(text, UNSUPPORTED_COUNTRIES) || mentions(text, UNSUPPORTED_ITEMS)) {
    const supported = getSupportedList();
    const countries = supported.countries.map((c) => c.label).join(", ");
    const items = supported.items.map((i) => i.label).join(", ");
    return finalize("unsupported", `현재 지원하지 않습니다.\n지원 국가: ${countries}\n지원 항목: ${items}`, [], supported);
  }

  const { values, askedCountries } = pickRelevantData(question);
  if (values.length === 0) return finalize("no_data", "해당 자료를 찾지 못했습니다");
  return buildAnswer(values, askedCountries);
}
