"use client";

// Design Ref: §11.1 — ③ 가상자산 비교. 국가 선택, 항목 선택(23번)과 비교표(24번: 값은 크게, 조건 설명은 작게)를 만들었다.
// 출처·기준일·상태 배지는 25번, 예외 안내는 26번에서 더한다.
// Plan SC: 국가는 최대 3개, 4번째를 고르면 선택되지 않게 하고 "최대 3개국까지 비교할 수 있습니다"라고 안내한다.

import { useState } from "react";
import CheckboxCard from "./CheckboxCard";
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

// 한 번에 비교할 수 있는 국가 수
const MAX_COUNTRIES = 3;

// 지원하는 국가와 항목 목록 (안내 문구용)
const SUPPORTED = getCryptoSupportedList();

// 비교표: 가로는 고른 국가, 세로는 고른 항목. 한 칸에는 등록된 규정을 한 건씩 보여 준다.
// 값(headline)은 크게, 조건 설명(detail)은 작게 보여 준다.
function CryptoTable({ countries, topics }: { countries: CryptoCountry[]; topics: CryptoTopic[] }) {
  if (countries.length === 0 || topics.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">국가와 항목을 선택하세요</p>;
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="w-full min-w-max border-collapse text-left">
        <caption className="sr-only">국가별 가상자산 조세 비교표</caption>
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
          {topics.map((topic) => (
            <tr key={topic}>
              <th
                scope="row"
                className="border-t border-zinc-300 bg-zinc-50 px-4 py-3 align-top font-medium dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                {CRYPTO_TOPIC_LABELS[topic]}
              </th>
              {countries.map((country) => {
                const rules = getCryptoRules(country, topic);
                return (
                  <td
                    key={country}
                    className="max-w-72 border-l border-t border-zinc-300 px-4 py-3 align-top dark:border-zinc-700"
                  >
                    {rules.length === 0 ? (
                      <span className="text-zinc-600 dark:text-zinc-400">해당 자료를 찾지 못했습니다</span>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {rules.map((rule) => (
                          <li key={`${rule.status}-${rule.source.url}-${rule.headline}`} className="flex flex-col gap-1">
                            <span className="text-lg font-semibold">{rule.headline}</span>
                            <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{rule.detail}</span>
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

export default function CryptoCompareSection() {
  const [selectedCountries, setSelectedCountries] = useState<CryptoCountry[]>([]);
  // 처음에는 핵심 4개(세율, 기본공제, 소득 구분, 손실 이월공제)가 선택돼 있다
  const [selectedTopics, setSelectedTopics] = useState<CryptoTopic[]>([...CORE_CRYPTO_TOPICS]);
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
  function toggleTopic(topic: CryptoTopic) {
    setSelectedTopics(selectedTopics.includes(topic) ? selectedTopics.filter((t) => t !== topic) : [...selectedTopics, topic]);
  }

  // 화면에는 항상 정해진 순서(핵심 4개가 먼저)로 보여 준다
  const countries = CRYPTO_COUNTRIES.filter((c) => selectedCountries.includes(c));
  const topics = CRYPTO_TOPICS.filter((t) => selectedTopics.includes(t));

  return (
    <section aria-labelledby="crypto-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="crypto-heading" className="text-2xl font-semibold">
          가상자산 비교
        </h2>
        {/* 선택지에 없는 국가·항목은 고를 수 없으므로, 지원 범위를 미리 알려 준다 */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          지원 범위: 국가 {SUPPORTED.countries.length}개({SUPPORTED.countries.map((c) => c.label).join(", ")}), 항목{" "}
          {SUPPORTED.topics.length}개({SUPPORTED.topics.map((t) => t.label).join(", ")}). 개인 거주자 기준이며, 이 밖의 국가와
          항목은 현재 지원하지 않습니다.
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
          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">{selectedTopics.length}개 선택</span>
        </legend>

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
      </fieldset>

      <CryptoTable countries={countries} topics={topics} />
    </section>
  );
}
