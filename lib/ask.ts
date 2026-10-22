// Design Ref: §3.2 ②~⑦ — 질문 처리: 서버 검사, 질문 분류, 자료 고르기, OpenAI 호출, 답변 점검, 공통 마무리.
// Plan SC: 자료 안에서만 답하기, 출처 1개 이상, 500자 이내, 모든 응답에 면책 문구, 세액 계산 요청 거절.

import { DISCLAIMER } from "./disclaimer";
import { OpenAiError, generateAnswer } from "./openai";
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

export { DISCLAIMER };
export const MAX_ANSWER_LENGTH = 500;

export type AskStatus = "ok" | "no_data" | "unsupported" | "refused" | "blocked" | "error";

export type AskResponse = {
  status: AskStatus;
  answer: string;
  sources: TaxSource[];
  supported?: ReturnType<typeof getSupportedList>; // unsupported일 때만
};

// 응답과 함께 돌려줄 HTTP 상태 번호
export type AskResult = { response: AskResponse; httpStatus: number };

// 답변 글을 만드는 함수. 실제로는 OpenAI를 부르고, 시험에서는 가짜 함수로 바꿔 끼운다.
export type GenerateFn = (question: string, values: readonly TaxValue[]) => Promise<string>;

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

// ── 응답 만들기 ─────────────────────────────────────────────

// 모든 응답의 마지막 단계: 어떤 status든 면책 문구를 붙인다
function finalize(status: AskStatus, message: string, sources: TaxSource[] = [], supported?: AskResponse["supported"]): AskResponse {
  return { status, answer: `${message}\n\n${DISCLAIMER}`, sources, ...(supported ? { supported } : {}) };
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

// 면책 문구가 들어갈 자리를 뺀, 본문에 쓸 수 있는 글자 수
const BODY_LIMIT = MAX_ANSWER_LENGTH - (DISCLAIMER.length + 2);
const TRUNCATED_NOTE = "…(길어서 일부만 표시했습니다)";

// 등록된 값을 국가·항목별 한 줄로 정리한 답. AI 답을 쓸 수 없을 때(숫자 점검 실패)의 대체 답이다.
function buildListAnswer(values: TaxValue[], askedCountries: Country[]): AskResponse {
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

  const join = (list: typeof lines) => list.map((l) => l.text).join("\n");
  let shown = lines;
  let body = join(lines);
  if (body.length > BODY_LIMIT) {
    // 줄 단위로 자른다. 숫자나 출처가 중간에 잘리지 않게 하고, 안내 문구가 들어갈 자리를 남긴다.
    shown = [];
    for (const line of lines) {
      const candidate = [...shown, line];
      if (join(candidate).length + 1 + TRUNCATED_NOTE.length > BODY_LIMIT) break;
      shown = candidate;
    }
    body = shown.length > 0 ? `${join(shown)}\n${TRUNCATED_NOTE}` : TRUNCATED_NOTE;
  }
  return finalize("ok", body, uniqueSources(shown.flatMap((l) => l.values.map((v) => v.source))));
}

// ── AI 답변 점검 (DESIGN ⑥) ─────────────────────────────────

// 자료 번호 표시. [S1], [S1][S2], [S1, S7]처럼 모델이 쓰는 여러 모양을 모두 읽는다.
const TAG_PATTERN = /\[\s*S\s*\d+(?:\s*[,，、]\s*S?\s*\d+)*\s*\]/g;

// 글 속 "12.5%" 같은 숫자를 모두 꺼낸다
function percentNumbers(text: string): number[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
}

// AI가 써도 되는 숫자: 보낸 자료의 값, 그리고 자료 메모에 적힌 퍼센트 숫자
function allowedPercents(values: readonly TaxValue[]): Set<number> {
  const allowed = new Set<number>();
  for (const v of values) {
    allowed.add(v.value);
    if (v.note) for (const n of percentNumbers(v.note)) allowed.add(n);
  }
  return allowed;
}

type Piece = { text: string; tags: Set<number> };

// 답변을 문장(또는 줄) 단위로 나누고, 문장마다 달린 자료 번호를 모은다. 번호 표시는 글에서 지운다.
function splitIntoPieces(raw: string, valueCount: number): Piece[] {
  const sentences = raw
    .split(/\n+|(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const pieces: Piece[] = [];
  for (const sentence of sentences) {
    const tags = new Set<number>();
    const text = sentence
      .replace(TAG_PATTERN, (group) => {
        for (const n of group.match(/\d+/g) ?? []) {
          const index = Number(n);
          // 보낸 자료에 없는 번호는 출처로 인정하지 않고 지운다
          if (index >= 1 && index <= valueCount) tags.add(index - 1);
        }
        return "";
      })
      .replace(/\s+([.,!?。])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (text === "") {
      // 마침표 뒤에 번호만 따로 떨어진 경우("입니다. [S1]")에는 앞 문장의 번호로 합친다
      const previous = pieces[pieces.length - 1];
      if (previous) for (const t of tags) previous.tags.add(t);
      continue;
    }
    pieces.push({ text, tags });
  }
  return pieces;
}

// AI가 쓴 글을 점검해 응답으로 바꾼다.
// - 숫자가 보낸 자료에 없으면 AI 글을 쓰지 않고 자료 정리 답으로 바꾼다
// - 출처 번호가 하나도 없으면 no_data로 바꾼다
// - 면책 문구를 포함해 500자를 넘으면 문장 단위로 줄인다
function checkAiAnswer(raw: string, values: TaxValue[], askedCountries: Country[]): AskResponse {
  const allowed = allowedPercents(values);
  // "15%p" 같은 퍼센트포인트 표현은 모델이 차이를 계산했다는 뜻이다. 계산한 숫자는 쓰지 않는다.
  const calculated = /%\s*p\b|%\s*포인트|퍼센트\s*포인트/i.test(raw);
  if (calculated || percentNumbers(raw).some((n) => !allowed.has(n))) return buildListAnswer(values, askedCountries);

  const pieces = splitIntoPieces(raw, values.length);
  if (!pieces.some((p) => p.tags.size > 0)) return finalize("no_data", "해당 자료를 찾지 못했습니다");

  // 기준일이 1년 넘은 자료를 인용했는데 AI가 "오래된 자료" 표시를 빼먹으면, 서버가 안내 줄을 덧붙인다
  const outdatedNote = (tagIndexes: number[], text: string): string => {
    if (text.includes("오래된 자료")) return "";
    const old = uniqueSources(tagIndexes.filter((i) => isOutdated(values[i])).map((i) => values[i].source));
    return old.length === 0 ? "" : `※ 오래된 자료(기준일 1년 초과): ${old.map((s) => `${s.org} ${s.asOf}`).join(", ")}`;
  };
  const allTags = [...new Set(pieces.flatMap((p) => [...p.tags]))];
  // 줄일 때 안내 줄이 들어갈 자리를 미리 남겨 둔다
  const reserved = outdatedNote(allTags, raw);
  const limit = BODY_LIMIT - (reserved ? reserved.length + 1 : 0);

  let shown = pieces;
  let body = pieces.map((p) => p.text).join("\n");
  if (body.length > limit) {
    shown = [];
    for (const piece of pieces) {
      const candidate = [...shown, piece];
      if (candidate.map((p) => p.text).join("\n").length + 1 + TRUNCATED_NOTE.length > limit) break;
      shown = candidate;
    }
    body = shown.length > 0 ? `${shown.map((p) => p.text).join("\n")}\n${TRUNCATED_NOTE}` : TRUNCATED_NOTE;
  }

  // 보이는 문장에 실제로 달린 번호의 출처만 붙인다
  const cited = [...new Set(shown.flatMap((p) => [...p.tags]))].sort((a, b) => a - b);
  if (cited.length === 0) return finalize("no_data", "해당 자료를 찾지 못했습니다");
  const note = outdatedNote(cited, body);
  return finalize("ok", note ? `${body}\n${note}` : body, uniqueSources(cited.map((i) => values[i].source)));
}

// OpenAI 호출이 실패했을 때의 응답. 키나 질문 내용은 담지 않는다.
function failureResult(error: unknown): AskResult {
  const reason = error instanceof OpenAiError ? error.reason : "upstream";
  if (reason === "no_key") return { response: finalize("error", "AI 서비스가 아직 설정되지 않았습니다"), httpStatus: 503 };
  if (reason === "timeout") return { response: finalize("error", "답변이 지연되고 있습니다. 잠시 후 다시 시도해 주세요"), httpStatus: 504 };
  return { response: finalize("error", "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요"), httpStatus: 502 };
}

// ── 질문 하나를 처리 ────────────────────────────────────────

// 입력이 잘못됐거나(error) 개인정보가 들어 있으면(blocked) 400, 그 외 정상 처리는 200이다.
function result(response: AskResponse): AskResult {
  return { response, httpStatus: response.status === "error" || response.status === "blocked" ? 400 : 200 };
}

export async function answerQuestion(input: unknown, generate: GenerateFn = generateAnswer): Promise<AskResult> {
  if (typeof input !== "string") return result(finalize("error", "질문을 읽을 수 없습니다"));
  const question = input.trim();

  if (question === "") return result(finalize("error", "질문을 입력해 주세요"));
  if (question.length > MAX_QUESTION_LENGTH) {
    return result(finalize("error", `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요`));
  }

  // 서버에서 2차 검사: 화면 검사를 믿지 않고 한 번 더 확인한다
  const pii = detectPii(question);
  if (pii.length > 0) return result(finalize("blocked", `개인정보로 보이는 내용이 있어 보낼 수 없습니다 (감지: ${pii.join(", ")})`));

  // 세액 계산·절세 요청과 지원 밖 질문은 AI를 부르지 않고 바로 답한다
  if (REFUSE_PATTERNS.some((pattern) => pattern.test(question))) {
    return result(finalize("refused", "세액 계산과 절세 자문은 제공하지 않습니다"));
  }
  const text = question.toLowerCase();
  if (mentions(text, UNSUPPORTED_COUNTRIES) || mentions(text, UNSUPPORTED_ITEMS)) {
    const supported = getSupportedList();
    const countries = supported.countries.map((c) => c.label).join(", ");
    const items = supported.items.map((i) => i.label).join(", ");
    return result(finalize("unsupported", `현재 지원하지 않습니다.\n지원 국가: ${countries}\n지원 항목: ${items}`, [], supported));
  }

  // 관련 자료가 없으면 AI를 부르지 않는다
  const { values, askedCountries } = pickRelevantData(question);
  if (values.length === 0) return result(finalize("no_data", "해당 자료를 찾지 못했습니다"));

  // 자료 + 질문을 AI에게 보내고, 돌아온 글을 점검한다
  let raw: string;
  try {
    raw = await generate(question, values);
  } catch (error) {
    return failureResult(error);
  }
  return result(checkAiAnswer(raw, values, askedCountries));
}
