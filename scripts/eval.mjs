// 대표 질문 20개로 정답률을 채점한다. (PLAN 작업 16, 성공 기준: 정답률 90% 이상)
//
// 사용법 (개발 서버를 먼저 띄워 둔다: npm run dev -- -p 3100)
//   node scripts/eval.mjs                 # 20개를 한 번씩 채점
//   node scripts/eval.mjs --runs 3        # 20개를 세 번 반복해 흔들림을 본다
//   node scripts/eval.mjs --only 3,7      # 일부 질문만
//   node scripts/eval.mjs --set tax       # 세율 질문(1~20번)만. --set crypto 는 가상자산 질문(21~40번)만. 기본은 전체
//   node scripts/eval.mjs --url http://localhost:3000
//
// 정답 기준(PRD 3번): 숫자와 출처가 모두 자료와 맞아야 정답이다.
// 질문마다 실제 OpenAI를 부르므로 비용이 조금 든다. 질문과 답은 저장하지 않고 화면에만 보여 준다.

import { readFileSync } from "node:fs";

const DISCLAIMER = "참고용이며 세무 자문이 아닙니다";
const MAX_ANSWER_LENGTH = 500;
const PASS_RATE = 0.9;

// ── 실행 옵션 ───────────────────────────────────────────────
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const baseUrl = option("url", "http://localhost:3100");
const runs = Math.max(1, Number(option("runs", "1")) || 1);
const only = option("only", "")
  .split(",")
  .filter(Boolean)
  .map(Number);

// 질문 묶음: 가상자산 질문에는 "set": "crypto"가 붙어 있고, 없으면 세율 질문(tax)이다
const set = option("set", "all");
const questions = JSON.parse(readFileSync(new URL("../data/eval-questions.json", import.meta.url), "utf8")).filter(
  (q) => (only.length === 0 || only.includes(q.id)) && (set === "all" || (q.set ?? "tax") === set),
);

// ── 채점 ────────────────────────────────────────────────────

// 답 안에 "25%" 같은 숫자가 있는지 본다. "125%"나 "2.5%"의 일부로 잘못 걸리지 않게 앞뒤를 확인한다.
function hasPercent(text, number) {
  const escaped = number.replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${escaped}\\s*%`).test(text);
}

// 질문 하나를 채점해 { ok, reasons } 를 돌려준다. reasons는 틀린 이유 목록이다.
function grade(question, response) {
  const reasons = [];
  const { expect } = question;
  const answer = response.answer ?? "";
  const urls = (response.sources ?? []).map((s) => s.url);

  // 안전하게 거절하는 것도 정답으로 인정하는 질문(alsoAcceptStatus)이 있다. 이때는 금지된 숫자만 없으면 된다.
  const accepted = [expect.status, ...(expect.alsoAcceptStatus ?? [])];
  const asExpected = response.status === expect.status;
  if (!accepted.includes(response.status)) reasons.push(`status가 ${response.status} (정답: ${accepted.join(" 또는 ")})`);
  if (!asExpected && accepted.includes(response.status)) {
    for (const n of expect.notPercents ?? []) if (hasPercent(answer, n)) reasons.push(`있으면 안 되는 ${n}%가 답에 있음`);
    if (urls.length > 0) reasons.push("출처가 없어야 하는 응답에 출처가 있음");
    if (!answer.endsWith(DISCLAIMER)) reasons.push("면책 문구로 끝나지 않음");
    return { ok: reasons.length === 0, reasons };
  }
  if (!answer.endsWith(DISCLAIMER)) reasons.push("면책 문구로 끝나지 않음");
  if (answer.length > MAX_ANSWER_LENGTH) reasons.push(`${answer.length}자 (500자 초과)`);
  if (/\[S\d/.test(answer)) reasons.push("자료 번호 표시([S1])가 남아 있음");

  for (const fragment of expect.text ?? []) {
    if (!answer.includes(fragment)) reasons.push(`'${fragment}' 문구 없음`);
  }
  // textAny: 묶음마다 그중 하나는 답에 있어야 한다 (같은 뜻을 다르게 쓸 수 있는 말)
  for (const group of expect.textAny ?? []) {
    if (!group.some((fragment) => answer.includes(fragment))) reasons.push(`'${group.join("' 또는 '")}' 중 하나가 답에 없음`);
  }

  if (expect.status === "ok") {
    for (const n of expect.percents ?? []) if (!hasPercent(answer, n)) reasons.push(`${n}%가 답에 없음`);
    for (const n of expect.notPercents ?? []) if (hasPercent(answer, n)) reasons.push(`있으면 안 되는 ${n}%가 답에 있음`);

    const required = expect.sources ?? [];
    for (const fragment of required) {
      if (!urls.some((u) => u.includes(fragment))) reasons.push(`필요한 출처 없음: ${fragment}`);
    }
    // 엉뚱한 출처가 섞이면 오답이다
    const allowed = [...required, ...(expect.allowedExtraSources ?? [])];
    for (const url of urls) {
      if (!allowed.some((f) => url.includes(f))) reasons.push(`엉뚱한 출처: ${url}`);
    }
    if (urls.length === 0) reasons.push("출처가 하나도 없음");
  } else if (urls.length > 0) {
    reasons.push("출처가 없어야 하는 응답에 출처가 있음");
  }
  return { ok: reasons.length === 0, reasons };
}

async function ask(question) {
  const started = Date.now();
  const res = await fetch(`${baseUrl}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ question }),
  });
  const body = await res.json();
  return { ...body, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

// ── 실행 ────────────────────────────────────────────────────
try {
  await fetch(baseUrl);
} catch {
  console.error(`서버에 연결할 수 없습니다 (${baseUrl}). 먼저 npm run dev -- -p 3100 으로 서버를 띄워 주세요.`);
  process.exit(2);
}

const passCount = new Map(questions.map((q) => [q.id, 0]));
const runRates = [];

for (let run = 1; run <= runs; run++) {
  if (runs > 1) console.log(`\n══ ${run}회차 ══`);
  let passed = 0;
  for (const q of questions) {
    let response;
    try {
      response = await ask(q.question);
    } catch (error) {
      response = { status: "error", answer: "", sources: [], seconds: "-" };
      console.log(`  (요청 실패: ${error.message})`);
    }
    const { ok, reasons } = grade(q, response);
    if (ok) {
      passed++;
      passCount.set(q.id, passCount.get(q.id) + 1);
    }
    console.log(`${ok ? "✅" : "❌"} ${String(q.id).padStart(2)}. ${q.question}  [${response.status}, ${response.seconds}초, 출처 ${response.sources?.length ?? 0}건]`);
    if (!ok) {
      for (const r of reasons) console.log(`      - ${r}`);
      console.log(`      답: ${response.answer.split("\n").join(" / ").slice(0, 260)}`);
    }
  }
  const rate = passed / questions.length;
  runRates.push(rate);
  console.log(`\n${runs > 1 ? `${run}회차 ` : ""}정답률: ${passed}/${questions.length} = ${(rate * 100).toFixed(0)}%`);
}

if (runs > 1) {
  console.log("\n══ 질문별 정답 횟수 ══");
  for (const q of questions) {
    const count = passCount.get(q.id);
    if (count < runs) console.log(`  ${String(q.id).padStart(2)}번 ${q.question}: ${count}/${runs}회`);
  }
  const total = [...passCount.values()].reduce((a, b) => a + b, 0);
  console.log(`전체 정답률: ${total}/${questions.length * runs} = ${((total / (questions.length * runs)) * 100).toFixed(0)}%`);
}

const worst = Math.min(...runRates);
console.log(`\n기준 ${PASS_RATE * 100}% 이상: ${worst >= PASS_RATE ? "통과" : "미달"}${runs > 1 ? " (가장 낮은 회차 기준)" : ""}`);
process.exit(worst >= PASS_RATE ? 0 : 1);
