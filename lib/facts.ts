// 질문 답변에 쓰는 자료 한 건. 세율 자료(TaxValue)와 가상자산 규정(CryptoRule) 두 가지가 있다.
// Design Ref: §11.4 — 질문 검색에 가상자산을 더한다. 두 분야의 자료를 같은 번호표(S1, S2…)로 AI에 보내기 위해 하나로 묶어 다룬다.

import type { CryptoRule } from "./crypto-data";
import type { TaxValue } from "./tax-data";

export type Fact = TaxValue | CryptoRule;

// 가상자산 규정이면 true (세율 자료에는 headline이 없다)
export function isCryptoFact(fact: Fact): fact is CryptoRule {
  return "headline" in fact;
}
