// CHECK.md 1번 (SEC-001): 다른 웹사이트가 방문자의 브라우저를 이용해 이 주소로 몰래 요청을 보내 OpenAI 요금을 쓰게 하는 것을 막는다.
// 한계: 이 검사는 "다른 사이트가 방문자 몰래 보내는 요청"만 막는다. 프로그램으로 직접 보내는 요청(curl 등)은 막지 못한다.
//       그쪽은 OpenAI 월 사용 한도와 Vercel 방화벽의 횟수 제한으로 막아야 한다.

export type GuardResult = { ok: true } | { ok: false; status: 403 | 415; message: string };

// 브라우저는 다른 사이트에서 보내는 요청에 Sec-Fetch-Site(요청이 어디서 왔는지)와 Origin(보낸 사이트 주소)을 반드시 붙인다.
// 우리 화면(같은 주소)에서 보낸 요청과 헤더가 없는 요청(서버·스크립트)은 통과시키고, 다른 사이트에서 온 것은 거절한다.
export function checkAskRequest(headers: Headers): GuardResult {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return { ok: false, status: 403, message: "허용되지 않은 요청입니다" };
  }

  const origin = headers.get("origin");
  if (origin !== null) {
    // 우리 사이트의 주소(Host). 프록시를 거치면 x-forwarded-host에 원래 주소가 담기므로 둘 다 인정한다.
    const allowedHosts = [headers.get("host"), headers.get("x-forwarded-host")].filter((h): h is string => !!h);
    let originHost = "";
    try {
      originHost = new URL(origin).host; // "null" 같은 값은 여기서 오류가 나 거절된다
    } catch {
      return { ok: false, status: 403, message: "허용되지 않은 요청입니다" };
    }
    if (!allowedHosts.includes(originHost)) return { ok: false, status: 403, message: "허용되지 않은 요청입니다" };
  }

  // 본문이 JSON이라고 밝힌 요청만 받는다. (text/plain 요청은 브라우저가 사전 확인 없이 다른 사이트에서 보낼 수 있다.)
  const contentType = (headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, message: "요청 형식이 올바르지 않습니다" };
  }

  return { ok: true };
}
