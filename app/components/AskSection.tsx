"use client";

// Design Ref: §2 — ③ 질문하기(입력창, 답변 카드), §3.2 — 화면에서 1차 검사 후 POST /api/ask로 보내고 답을 받아 보여 준다.
// Plan SC: 답변과 출처(기관명·링크·기준일)를 함께 보여 준다. 모든 답변 끝에 면책 문구가 있다.
// 주의: 서버 전용 코드(lib/ask.ts, lib/openai.ts)는 여기서 불러오지 않는다. 모양(type)만 가져온다.

import { useRef, useState, type FormEvent } from "react";
import { DISCLAIMER } from "@/lib/disclaimer";
import { MAX_QUESTION_LENGTH, detectPii } from "@/lib/pii";
import type { AskResponse, AskStatus } from "@/lib/ask";

// 이 시간 안에 서버가 답하지 않으면 기다리기를 멈춘다 (서버는 OpenAI를 25초까지 기다린다)
const CLIENT_TIMEOUT_MS = 35_000;

const GENERIC_ERROR: AskResponse = {
  status: "error",
  answer: `답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요\n\n${DISCLAIMER}`,
  sources: [],
};

const STATUSES: AskStatus[] = ["ok", "no_data", "unsupported", "refused", "blocked", "error"];

// 서버가 돌려준 값이 약속한 모양인지 확인한다. 아니면 오류로 본다.
function isAskResponse(value: unknown): value is AskResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === "string" &&
    (STATUSES as string[]).includes(v.status) &&
    typeof v.answer === "string" &&
    Array.isArray(v.sources)
  );
}

type View = { kind: "idle" } | { kind: "loading" } | { kind: "done"; response: AskResponse };

export default function AskSection() {
  const [question, setQuestion] = useState("");
  // 보내기 전 검사에서 걸린 경우의 안내 (빈 질문, 글자 수 초과)
  const [submitNotice, setSubmitNotice] = useState("");
  const [view, setView] = useState<View>({ kind: "idle" });
  // 질문을 연달아 보냈을 때 늦게 온 옛 답이 새 답을 덮어쓰지 않게 번호를 매긴다
  const requestId = useRef(0);

  // 입력하는 동안에도 바로 알려 주는 검사 결과
  const piiKinds = detectPii(question);
  const tooLong = question.length > MAX_QUESTION_LENGTH;
  const loading = view.kind === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (question.trim() === "") {
      setSubmitNotice("질문을 입력해 주세요");
      return;
    }
    if (tooLong) {
      setSubmitNotice(`질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요`);
      return;
    }
    // 개인정보가 있으면 보내지 않는다. 경고는 아래에 항상 보이고 있다.
    if (piiKinds.length > 0) return;

    setSubmitNotice("");
    const id = ++requestId.current;
    setView({ kind: "loading" });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
      // 개인정보·입력 오류(400)도 같은 모양의 JSON으로 온다
      const data: unknown = await res.json();
      if (id === requestId.current) setView({ kind: "done", response: isAskResponse(data) ? data : GENERIC_ERROR });
    } catch {
      if (id === requestId.current) setView({ kind: "done", response: GENERIC_ERROR });
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <section aria-labelledby="ask-heading" className="flex flex-col gap-4">
      <h2 id="ask-heading" className="text-2xl font-semibold">
        질문하기
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="question" className="text-base font-medium">
          궁금한 점을 문장으로 물어보세요
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setSubmitNotice("");
          }}
          rows={3}
          placeholder="예: 미국과 일본의 배당 원천세율 차이는?"
          aria-describedby="question-count question-warning"
          aria-invalid={tooLong || piiKinds.length > 0}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[invalid=true]:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-400 dark:aria-[invalid=true]:border-red-400"
        />

        <div className="flex items-start justify-between gap-4">
          {/* 경고 문구 자리를 항상 비워 두어, 문구가 나타나도 화면이 흔들리지 않게 한다 */}
          <div id="question-warning" role="status" className="min-h-6 text-sm font-medium text-red-700 dark:text-red-300">
            {piiKinds.length > 0
              ? `개인정보로 보이는 내용이 있어 보낼 수 없습니다 (감지: ${piiKinds.join(", ")})`
              : tooLong
                ? `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요`
                : submitNotice}
          </div>
          <p
            id="question-count"
            className={`shrink-0 text-sm ${tooLong ? "font-medium text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}
          >
            {question.length}/{MAX_QUESTION_LENGTH}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 self-start rounded-lg bg-blue-700 px-6 py-2 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          {loading ? "찾는 중…" : "물어보기"}
        </button>
      </form>

      {/* 답변 카드: 읽어 주는 프로그램(스크린리더)이 새 답을 알려 주도록 aria-live를 둔다 */}
      <div aria-live="polite" aria-busy={loading} className="min-h-6">
        {loading && <p className="text-zinc-600 dark:text-zinc-400">자료에서 찾고 있습니다. 잠시만 기다려 주세요…</p>}
        {view.kind === "done" && <AnswerCard response={view.response} />}
      </div>
    </section>
  );
}

// 답변 카드. 정상 답변(ok)과 안내(자료 없음, 지원 밖, 거절, 차단, 오류)의 색을 다르게 보여 준다.
function AnswerCard({ response }: { response: AskResponse }) {
  const isAnswer = response.status === "ok";
  const label = isAnswer ? "답변" : response.status === "error" || response.status === "blocked" ? "오류" : "안내";
  const tone = isAnswer
    ? "border-blue-300 bg-white dark:border-blue-800 dark:bg-zinc-900"
    : response.status === "error" || response.status === "blocked"
      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
      : "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950";

  return (
    <article className={`flex flex-col gap-4 rounded-lg border px-4 py-4 sm:px-6 ${tone}`}>
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</h3>
      {/* 줄바꿈을 그대로 보여 준다. 답변 끝의 면책 문구도 이 글에 들어 있다. */}
      <p className="whitespace-pre-line text-base leading-7">{response.answer}</p>

      {response.sources.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">출처</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {response.sources.map((source) => (
              <li key={`${source.url}-${source.asOf}`} className="flex flex-wrap items-baseline gap-x-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline underline-offset-2 dark:text-blue-300"
                >
                  {source.org}
                  <span className="sr-only"> (새 창에서 열림)</span>
                </a>
                <span className="text-zinc-600 dark:text-zinc-400">기준일 {source.asOf}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
