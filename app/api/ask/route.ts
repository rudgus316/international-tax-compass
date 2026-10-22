// Design Ref: §3.4 — POST /api/ask. 질문을 받아 lib/ask.ts의 규칙대로 처리하고 { status, answer, sources[] }를 돌려준다.
// 질문은 저장하지 않고 로그에도 남기지 않는다. (보안 규칙)

import { DISCLAIMER, answerQuestion, type AskResponse } from "@/lib/ask";

function toResponse(body: AskResponse, httpStatus: number) {
  return Response.json(body, { status: httpStatus });
}

export async function POST(request: Request) {
  try {
    let question: unknown;
    try {
      question = ((await request.json()) as { question?: unknown } | null)?.question;
    } catch {
      // 본문이 JSON이 아닌 경우
      question = undefined;
    }

    const result = answerQuestion(question);
    // 입력이 잘못됐거나(error) 개인정보가 들어 있으면(blocked) 400, 그 외에는 200
    const httpStatus = result.status === "error" || result.status === "blocked" ? 400 : 200;
    return toResponse(result, httpStatus);
  } catch {
    // 예상하지 못한 오류. 질문 내용은 로그에 남기지 않는다.
    return toResponse(
      { status: "error", answer: `답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요\n\n${DISCLAIMER}`, sources: [] },
      500,
    );
  }
}
