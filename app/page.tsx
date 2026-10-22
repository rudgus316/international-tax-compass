// Design Ref: §2 — 화면 구성 (① 머리말, ② 비교하기, ③ 질문하기, ④ 바닥글)
// 디자인: 남색 바탕에 점으로 찍은 세계지도를 깐 머리말, 연한 회색 바탕 위의 흰 카드 본문, 남색 바닥글.
import AskSection from "./components/AskSection";
import CompareSection from "./components/CompareSection";
import CompassIcon from "./components/CompassIcon";
import WorldMap from "./components/WorldMap";
import { COUNTRIES, COUNTRY_LABELS, ITEMS } from "@/lib/tax-data";

// 본문 구역을 감싸는 카드 모양
const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-slate-100 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ① 머리말: 세계지도 배경, 앱 이름, 한 줄 설명, 입력 주의 안내 */}
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-[#06112b] via-[#0a2150] to-[#12397d] text-white">
        {/* 지도는 항상 가로 전체가 다 보이게 원래 비율로 위쪽에 둔다(한국·일본 표시가 잘리지 않게). 아래쪽은 서서히 사라진다. */}
        <WorldMap className="pointer-events-none absolute inset-x-0 top-0 -z-10 aspect-[720/280] w-full [mask-image:linear-gradient(to_bottom,black_65%,transparent)]" />
        {/* 넓은 화면에서만: 글자가 지도 위에서도 또렷하게 읽히도록 왼쪽을 어둡게 눌러 준다 */}
        <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-[#06112b]/90 via-[#06112b]/55 to-transparent sm:block" />

        {/* break-keep: 한국어가 단어 중간에서 줄이 바뀌지 않게 한다 */}
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-20 pt-[34vw] break-keep sm:px-8 sm:pb-28 sm:pt-16">
          <div className="flex items-center gap-3">
            <CompassIcon className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" />
            <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-300 sm:text-sm sm:tracking-[0.25em]">
              INTERNATIONAL TAX COMPASS
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-[2rem] leading-tight font-extrabold tracking-tight sm:text-6xl">국제조세 나침반</h1>
            <p className="max-w-xl text-lg text-blue-100 sm:text-xl">OECD 주요국 조세를 비교하고 물어보세요</p>
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="지원하는 국가">
            {COUNTRIES.map((code) => (
              <li
                key={code}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur-sm"
              >
                {COUNTRY_LABELS[code]}
              </li>
            ))}
          </ul>

          <p className="text-sm text-blue-200">
            {COUNTRIES.length}개국 · {ITEMS.length}개 항목 · 모든 값에 출처와 기준일 표시
          </p>

          <p
            role="note"
            className="max-w-2xl rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100"
          >
            <span aria-hidden="true">⚠ </span>
            회사 기밀이나 개인정보는 입력하지 마세요. 질문은 AI 서비스 업체(OpenAI)로 전송됩니다.
          </p>
        </div>
      </header>

      {/* ② 비교하기, ③ 질문하기: 머리말 위로 살짝 걸쳐 올라오는 카드 */}
      <main className="relative z-10 mx-auto -mt-10 flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-12 sm:-mt-14 sm:px-8">
        <div className={CARD}>
          <CompareSection />
        </div>
        <div className={CARD}>
          <AskSection />
        </div>
      </main>

      {/* ④ 바닥글: 모든 화면에 보이는 면책 문구 */}
      <footer className="bg-[#06112b] text-slate-300">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-8 sm:px-8">
          <p className="font-medium text-white">참고용이며 세무 자문이 아닙니다</p>
          <p className="text-sm text-slate-400">국제조세 나침반 · 등록된 공개 자료만 사용합니다</p>
        </div>
      </footer>
    </div>
  );
}
