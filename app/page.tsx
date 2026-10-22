// Design Ref: §2 — 화면 구성 (① 머리말, ② 비교하기, ③ 질문하기, ④ 바닥글)
import AskSection from "./components/AskSection";
import CompareSection from "./components/CompareSection";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* ① 머리말: 앱 이름, 한 줄 설명, 입력 주의 안내 */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-8 sm:px-8 sm:py-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">국제조세 나침반</h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">OECD 주요국 조세를 비교하고 물어보세요</p>
          <p
            role="note"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <span aria-hidden="true">⚠ </span>
            회사 기밀이나 개인정보는 입력하지 마세요. 질문은 AI 서비스 업체(OpenAI)로 전송됩니다.
          </p>
        </div>
      </header>

      {/* ② 비교하기, ③ 질문하기 */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 py-8 sm:px-8">
        <CompareSection />
        <AskSection />
      </main>

      {/* ④ 바닥글: 모든 화면에 보이는 면책 문구 */}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-zinc-600 sm:px-8 dark:text-zinc-400">
          참고용이며 세무 자문이 아닙니다
        </p>
      </footer>
    </div>
  );
}
