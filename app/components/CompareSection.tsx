"use client";

// Design Ref: §2 — ② 비교하기. 국가 선택, 항목 선택, 비교표(값, 출처, 기준일, 오래된 자료 표시)를 만들었다.
// 예외 문구(자료 없음, 자료 간 차이, 지원하지 않는 항목)는 이후 작업에서 표에 추가한다.
// Plan SC: 모든 값에 출처(기관명·URL·기준일)를 붙인다. 기준일이 1년 넘은 값에는 "오래된 자료"를 표시한다.
// Plan SC: 4번째 국가를 고르려 하면 선택되지 않게 하고 "최대 3개국까지 비교할 수 있습니다"라고 안내한다.

import { useState } from "react";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  ITEMS,
  ITEM_LABELS,
  RATE_TYPE_LABELS,
  getValues,
  isOutdated,
  type Country,
  type Item,
} from "@/lib/tax-data";

// 한 번에 비교할 수 있는 국가 수
const MAX_COUNTRIES = 3;

// 체크박스 한 칸 (국가와 항목 선택이 같은 모양을 쓴다)
function CheckboxCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950">
      <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

// 비교표: 가로는 고른 국가, 세로는 고른 항목. 한 칸에는 등록된 세율을 종류별로 한 줄씩 보여 준다.
function CompareTable({ countries, items }: { countries: Country[]; items: Item[] }) {
  if (countries.length === 0 || items.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">국가와 항목을 선택하세요</p>;
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full min-w-max border-collapse text-left">
        <caption className="sr-only">국가별 조세 비교표</caption>
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-800">
            <th scope="col" className="border-b border-zinc-300 px-4 py-3 font-semibold dark:border-zinc-700">
              항목
            </th>
            {countries.map((country) => (
              <th
                key={country}
                scope="col"
                className="border-b border-l border-zinc-300 px-4 py-3 font-semibold dark:border-zinc-700"
              >
                {COUNTRY_LABELS[country]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item}>
              <th
                scope="row"
                className="border-t border-zinc-300 bg-zinc-50 px-4 py-3 align-top font-medium dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                {ITEM_LABELS[item]}
              </th>
              {countries.map((country) => {
                const values = getValues(country, item);
                return (
                  <td key={country} className="border-l border-t border-zinc-300 px-4 py-3 align-top dark:border-zinc-700">
                    {values.length === 0 ? (
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {values.map((v) => (
                          <li key={`${v.rateType}-${v.source.url}`} className="flex flex-col gap-0.5">
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">{RATE_TYPE_LABELS[v.rateType]}</span>
                            <span className="text-lg font-semibold">{v.value}%</span>
                            {/* 출처: 기관명(자료 주소로 연결)과 기준일. 모든 값에 반드시 붙는다 */}
                            <a
                              href={v.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-700 underline underline-offset-2 dark:text-blue-300"
                            >
                              {v.source.org}
                              <span className="sr-only"> (새 창에서 열림)</span>
                            </a>
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">
                              기준일 {v.source.asOf}
                              {isOutdated(v) && (
                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                  오래된 자료
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareSection() {
  const [selectedCountries, setSelectedCountries] = useState<Country[]>([]);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState("");

  function toggleCountry(country: Country) {
    // 이미 고른 국가는 해제한다
    if (selectedCountries.includes(country)) {
      setSelectedCountries(selectedCountries.filter((c) => c !== country));
      setNotice("");
      return;
    }
    // 4번째 국가는 선택하지 않고 안내만 보여 준다
    if (selectedCountries.length >= MAX_COUNTRIES) {
      setNotice(`최대 ${MAX_COUNTRIES}개국까지 비교할 수 있습니다`);
      return;
    }
    setSelectedCountries([...selectedCountries, country]);
    setNotice("");
  }

  // 항목은 개수 제한 없이 여러 개를 고를 수 있다
  function toggleItem(item: Item) {
    setSelectedItems(selectedItems.includes(item) ? selectedItems.filter((i) => i !== item) : [...selectedItems, item]);
  }

  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-6">
      <h2 id="compare-heading" className="text-2xl font-semibold">
        비교하기
      </h2>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-medium">
          국가 선택 (최대 {MAX_COUNTRIES}개){" "}
          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
            {selectedCountries.length}/{MAX_COUNTRIES} 선택
          </span>
        </legend>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COUNTRIES.map((country) => (
            <CheckboxCard
              key={country}
              label={COUNTRY_LABELS[country]}
              checked={selectedCountries.includes(country)}
              onChange={() => toggleCountry(country)}
            />
          ))}
        </div>

        {/* 안내 문구 자리를 항상 비워 두어, 문구가 나타나도 화면이 흔들리지 않게 한다 */}
        <p role="status" className="min-h-6 text-sm font-medium text-red-700 dark:text-red-300">
          {notice}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-medium">
          항목 선택 (여러 개 선택 가능){" "}
          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
            {selectedItems.length}개 선택
          </span>
        </legend>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ITEMS.map((item) => (
            <CheckboxCard
              key={item}
              label={ITEM_LABELS[item]}
              checked={selectedItems.includes(item)}
              onChange={() => toggleItem(item)}
            />
          ))}
        </div>
      </fieldset>

      <CompareTable
        countries={COUNTRIES.filter((c) => selectedCountries.includes(c))}
        items={ITEMS.filter((i) => selectedItems.includes(i))}
      />
    </section>
  );
}
