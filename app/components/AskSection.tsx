"use client";

// Design Ref: §2 — ③ 질문하기, §3.2 ① — 화면에서 1차 검사. 이번 작업에서는 입력창과 검사까지 만들고,
// 질문을 서버로 보내 답을 받는 부분은 이후 작업(질문 처리 서버 코드, OpenAI 연결, 답변 화면)에서 연결한다.
// Plan SC: 개인정보 패턴이 보이면 전송하기 전에 막고 경고를 보여 준다. 질문은 300자 이내.

import { useState, type FormEvent } from "react";
import { MAX_QUESTION_LENGTH, detectPii } from "@/lib/pii";

export default function AskSection() {
  const [question, setQuestion] = useState("");
  // 보내기 버튼을 눌렀을 때의 결과 안내 (빈 질문, 글자 수 초과, 통과)
  const [submitNotice, setSubmitNotice] = useState("");
  // 안내가 오류가 아니라 통과 결과일 때는 빨간색이 아닌 보통 색으로 보여 준다
  const [submitPassed, setSubmitPassed] = useState(false);

  // 입력하는 동안에도 바로 알려 주는 검사 결과
  const piiKinds = detectPii(question);
  const tooLong = question.length > MAX_QUESTION_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitPassed(false);
    if (question.trim() === "") {
      setSubmitNotice("질문을 입력해 주세요");
      return;
    }
    if (tooLong) {
      setSubmitNotice(`질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요`);
      return;
    }
    if (piiKinds.length > 0) {
      // 개인정보가 있으면 보내지 않는다. 경고는 아래에 항상 보이고 있다.
      setSubmitNotice("");
      return;
    }
    // 아직 서버와 연결되지 않았다. 질문 전송은 이후 작업에서 이 자리에 붙인다.
    setSubmitPassed(true);
    setSubmitNotice("검사를 통과했습니다. 질문 전송은 아직 연결되지 않았습니다 (준비 중)");
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
            setSubmitPassed(false);
          }}
          rows={3}
          placeholder="예: 미국과 일본의 배당 원천세율 차이는?"
          aria-describedby="question-count question-warning"
          aria-invalid={tooLong || piiKinds.length > 0}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[invalid=true]:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-400 dark:aria-[invalid=true]:border-red-400"
        />

        <div className="flex items-start justify-between gap-4">
          {/* 경고 문구 자리를 항상 비워 두어, 문구가 나타나도 화면이 흔들리지 않게 한다 */}
          <div
            id="question-warning"
            role="status"
            className={`min-h-6 text-sm font-medium ${submitPassed ? "text-zinc-700 dark:text-zinc-300" : "text-red-700 dark:text-red-300"}`}
          >
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
          className="min-h-12 self-start rounded-lg bg-blue-700 px-6 py-2 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          물어보기
        </button>
      </form>
    </section>
  );
}
