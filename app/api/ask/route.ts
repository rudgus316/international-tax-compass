// Design Ref: §3.4 — POST /api/ask. 질문을 받아 lib/ask.ts의 규칙대로 처리하고 { status, answer, sources[] }를 돌려준다.
// 질문은 저장하지 않고 로그에도 남기지 않는다. (보안 규칙)

import { DISCLAIMER, answerQuestion } from "@/lib/ask";
import { checkAskRequest } from "@/lib/request-guard";

export async function POST(request: Request) {
  // 다른 사이트가 방문자 몰래 보낸 요청과 JSON이 아닌 요청은 OpenAI를 부르기 전에 거절한다. (CHECK.md 1번)
  const guard = checkAskRequest(request.headers);
  if (!guard.ok) {
    return Response.json({ status: "error", answer: `${guard.message}\n\n${DISCLAIMER}`, sources: [] }, { status: guard.status });
  }

  try {
    let question: unknown;
    try {
      question = ((await request.json()) as { question?: unknown } | null)?.question;
    } catch {
      // 본문이 JSON이 아닌 경우
      question = undefined;
    }

    // request.signal: 사용자가 창을 닫거나 연결이 끊기면 알려 준다. OpenAI 호출도 멈춰서 요금이 더 나가지 않게 한다.
    const { response, httpStatus } = await answerQuestion(question, undefined, request.signal);
    return Response.json(response, { status: httpStatus });
  } catch {
    // 예상하지 못한 오류. 질문 내용은 로그에 남기지 않는다.
    return Response.json(
      { status: "error", answer: `답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요\n\n${DISCLAIMER}`, sources: [] },
      { status: 500 },
    );
  }
}
