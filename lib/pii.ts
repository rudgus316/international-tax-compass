// Design Ref: §3.2 ①② — 개인정보 패턴 검사. 화면(1차)과 서버(2차)가 같은 규칙을 쓴다.
// Plan SC: 주민등록번호·이메일 같은 개인정보 패턴이 보이면 AI로 보내기 전에 막는다.

export type PiiKind = "주민등록번호" | "이메일" | "전화번호";

// 질문 글자 수 제한 (AI 비용 폭주 방지)
export const MAX_QUESTION_LENGTH = 300;

// 패턴 목록. 숫자는 다른 숫자 덩어리의 일부일 때 걸리지 않도록 앞뒤 경계를 둔다.
const PATTERNS: { kind: PiiKind; regex: RegExp }[] = [
  // 주민등록번호·외국인등록번호: 앞 6자리 + 뒤 7자리(첫 자리 1~8). 하이픈이나 공백은 있어도 없어도 된다.
  { kind: "주민등록번호", regex: /(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)/ },
  { kind: "이메일", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/ },
  // 휴대전화: 010·011·016·017·018·019, 국제번호(+82) 허용
  { kind: "전화번호", regex: /(?<!\d)(?:\+82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/ },
  // 일반전화: 02-1234-5678, 031-123-4567 (하이픈이나 공백으로 나뉜 경우만)
  { kind: "전화번호", regex: /(?<!\d)0\d{1,2}[-\s]\d{3,4}[-\s]\d{4}(?!\d)/ },
];

// 글 안에서 발견된 개인정보 종류를 돌려준다. 없으면 빈 목록이다.
export function detectPii(text: string): PiiKind[] {
  const found = new Set<PiiKind>();
  for (const { kind, regex } of PATTERNS) {
    if (regex.test(text)) found.add(kind);
  }
  return [...found];
}
