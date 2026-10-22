"use client";

// Design Ref: §2 — ② 비교하기. 국가 선택, 항목 선택, 비교표(값, 출처, 기준일, 오래된 자료 표시)를 만들었다.
// 가상자산(2차 사이클)은 따로 구역을 두지 않고, 같은 국가 선택과 같은 항목 선택·같은 비교표에 항목으로 넣었다.
// 예외 처리: 자료 없음, 자료 간 차이 있음, 한국 조약 세율 해당 없음, 지원 범위 안내(세율 항목은 6개국만).
// Plan SC: 모든 값에 출처(기관명·URL·기준일)를 붙인다. 기준일이 1년 넘은 값에는 "오래된 자료"를 표시한다.
// Plan SC: 4번째 국가를 고르려 하면 선택되지 않게 하고 "최대 3개국까지 비교할 수 있습니다"라고 안내한다.

import { useState } from "react";
import CheckboxCard from "./CheckboxCard";
import CryptoRuleList from "./CryptoRuleList";
import {
  CORE_CRYPTO_TOPICS,
  CRYPTO_COUNTRIES,
  CRYPTO_COUNTRY_LABELS,
  CRYPTO_TOPICS,
  CRYPTO_TOPIC_LABELS,
  getCryptoRules,
  getCryptoSupportedList,
  type CryptoCountry,
  type CryptoTopic,
} from "@/lib/crypto-data";
import { buildCompareCsv, csvFileName } from "@/lib/csv";
import {
  ITEMS,
  ITEM_LABELS,
  RATE_TYPE_LABELS,
  getSupportedList,
  getValues,
  hasConflict,
  isNotApplicable,
  isOutdated,
  isSupportedCountry,
  type Item,
} from "@/lib/tax-data";

// 한 번에 비교할 수 있는 국가 수
const MAX_COUNTRIES = 3;

// 지원하는 국가와 항목 목록 (안내 문구용)
const SUPPORTED = getSupportedList();
const CRYPTO_SUPPORTED = getCryptoSupportedList();

// 지금 보이는 비교표를 CSV 파일로 내려받는다. 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM(﻿)을 붙인다.
function downloadCsv(countries: CryptoCountry[], items: Item[], topics: CryptoTopic[]) {
  const today = new Date();
  const blob = new Blob([`﻿${buildCompareCsv(countries, items, today, topics)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName(today);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 내려받기가 시작된 뒤에 임시 주소를 지운다
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 비교표: 가로는 고른 국가, 세로는 고른 항목(세율 항목 다음에 가상자산 항목). 한 칸에는 등록된 값을 한 건씩 보여 준다.
function CompareTable({
  countries,
  items,
  topics,
}: {
  countries: CryptoCountry[];
  items: Item[];
  topics: CryptoTopic[];
}) {
  if (countries.length === 0 || items.length + topics.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">국가와 항목을 선택하세요</p>;
  }


  return (
    <div className="flex flex-col gap-3">
      {/* 가상자산 항목이 표에 있을 때는 표 바로 위에 주의 문구를 둔다 (값은 바뀌거나 시행이 미뤄질 수 있다) */}
      {topics.length > 0 && (
        <p
          role="note"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <span aria-hidden="true">⚠ </span>
          가상자산 세법은 자주 바뀝니다. 값마다 상태(시행 중·시행 예정·논의 중)와 기준일을 확인하세요. 개인 거주자 기준이며
          투자 권유가 아닙니다.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => downloadCsv(countries, items, topics)}
          className="min-h-12 rounded-lg border border-blue-700 bg-white px-5 py-2 font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-400 dark:bg-zinc-900 dark:text-blue-200 dark:hover:bg-blue-950"
        >
          엑셀(CSV)로 내려받기
        </button>
      </div>
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
                  {CRYPTO_COUNTRY_LABELS[country]}
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
                  // 세율 비교는 6개국만 지원한다 (싱가포르·호주·캐나다·스위스는 가상자산 항목만)
                  if (!isSupportedCountry(country)) {
                    return (
                      <td key={country} className="border-l border-t border-zinc-300 px-4 py-3 align-top dark:border-zinc-700">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          현재 지원하지 않습니다 (세율 항목은 {SUPPORTED.countries.map((c) => c.label).join(", ")}만 지원)
                        </span>
                      </td>
                    );
                  }
                  const values = getValues(country, item);
                  // 한국의 조세조약 세율은 기준국이라 만들지 않는다 (원천세율 항목에서만 안내)
                  const treatyNotApplicable = item !== "corporate" && isNotApplicable(country, "treaty");
                  return (
                    <td key={country} className="border-l border-t border-zinc-300 px-4 py-3 align-top dark:border-zinc-700">
                      {values.length === 0 && !treatyNotApplicable && (
                        <span className="text-zinc-600 dark:text-zinc-400">해당 자료를 찾지 못했습니다</span>
                      )}
                      {hasConflict(values) && (
                        <p className="mb-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900 dark:text-red-100">
                          자료 간 차이 있음
                        </p>
                      )}
                      {values.length > 0 && (
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
                      {treatyNotApplicable && (
                        <p className={`flex flex-col text-xs text-zinc-600 dark:text-zinc-400 ${values.length > 0 ? "mt-2" : ""}`}>
                          <span>{RATE_TYPE_LABELS.treaty}</span>
                          <span className="text-sm font-medium">해당 없음(기준국)</span>
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {topics.map((topic) => (
              <tr key={topic}>
                <th
                  scope="row"
                  className="border-t border-zinc-300 bg-zinc-50 px-4 py-3 align-top font-medium dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  {CRYPTO_TOPIC_LABELS[topic]}
                  <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">가상자산</span>
                </th>
                {countries.map((country) => {
                  const rules = getCryptoRules(country, topic);
                  return (
                    <td key={country} className="border-l border-t border-zinc-300 px-4 py-3 align-top dark:border-zinc-700">
                      {rules.length === 0 ? (
                        <span className="text-zinc-600 dark:text-zinc-400">해당 자료를 찾지 못했습니다</span>
                      ) : (
                        <CryptoRuleList rules={rules} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CompareSection() {
  const [selectedCountries, setSelectedCountries] = useState<CryptoCountry[]>([]);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  // 가상자산은 세율 항목과 같은 줄의 항목 하나로 두고, 켜면 세부 항목(세율·기본공제·소득 구분 등)을 고른다
  const [cryptoOn, setCryptoOn] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<CryptoTopic[]>([]);
  const [notice, setNotice] = useState("");

  function toggleCountry(country: CryptoCountry) {
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

  // 가상자산을 처음 켜면 핵심 4개(세율, 기본공제, 소득 구분, 손실 이월공제)를 미리 골라 둔다
  function toggleCrypto() {
    if (!cryptoOn && selectedTopics.length === 0) setSelectedTopics([...CORE_CRYPTO_TOPICS]);
    setCryptoOn(!cryptoOn);
  }

  function toggleTopic(topic: CryptoTopic) {
    setSelectedTopics(selectedTopics.includes(topic) ? selectedTopics.filter((t) => t !== topic) : [...selectedTopics, topic]);
  }

  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="compare-heading" className="text-2xl font-semibold">
          비교하기
        </h2>
        {/* 선택지에 없는 국가·항목은 고를 수 없으므로, 지원 범위를 미리 알려 준다 */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          지원 범위: 국가 {CRYPTO_SUPPORTED.countries.length}개({CRYPTO_SUPPORTED.countries.map((c) => c.label).join(", ")}).
          세율 항목 {SUPPORTED.items.length}개({SUPPORTED.items.map((i) => i.label).join(", ")})는{" "}
          {SUPPORTED.countries.map((c) => c.label).join(", ")} {SUPPORTED.countries.length}개국만, 가상자산 항목{" "}
          {CRYPTO_SUPPORTED.topics.length}개({CRYPTO_SUPPORTED.topics.map((t) => t.label).join(", ")})는 개인 거주자 기준으로 10개국 모두
          지원합니다. 이 밖의 국가와 항목은 현재 지원하지 않습니다.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-medium">
          국가 선택 (최대 {MAX_COUNTRIES}개){" "}
          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
            {selectedCountries.length}/{MAX_COUNTRIES} 선택
          </span>
        </legend>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CRYPTO_COUNTRIES.map((country) => (
            <CheckboxCard
              key={country}
              label={CRYPTO_COUNTRY_LABELS[country]}
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
            {selectedItems.length + (cryptoOn ? selectedTopics.length : 0)}개 선택
          </span>
        </legend>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ITEMS.map((item) => (
            <CheckboxCard
              key={item}
              label={ITEM_LABELS[item]}
              checked={selectedItems.includes(item)}
              onChange={() => toggleItem(item)}
            />
          ))}
          <CheckboxCard label="가상자산" checked={cryptoOn} onChange={toggleCrypto} />
        </div>

        {/* 가상자산을 고르면 세부 항목을 체크해서 비교한다 */}
        {cryptoOn && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              가상자산 세부 항목{" "}
              <span className="font-normal text-zinc-600 dark:text-zinc-400">
                (개인 거주자 기준, 세법은 자주 바뀌니 기준일과 상태를 확인하세요. 투자 권유가 아닙니다)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CRYPTO_TOPICS.map((topic) => (
                <CheckboxCard
                  key={topic}
                  label={CRYPTO_TOPIC_LABELS[topic]}
                  checked={selectedTopics.includes(topic)}
                  onChange={() => toggleTopic(topic)}
                />
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <CompareTable
        countries={CRYPTO_COUNTRIES.filter((c) => selectedCountries.includes(c))}
        items={ITEMS.filter((i) => selectedItems.includes(i))}
        topics={cryptoOn ? CRYPTO_TOPICS.filter((t) => selectedTopics.includes(t)) : []}
      />
    </section>
  );
}
