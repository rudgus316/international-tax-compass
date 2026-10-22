"use client";

// Design Ref: §11.1 — ③ 가상자산 비교. 이 작업(23번)은 국가 선택과 항목 선택, 구역 자리까지 만든다.
// 비교표는 24번, 출처·상태 배지는 25번, 예외 안내는 26번에서 더한다.
// Plan SC: 국가는 최대 3개, 4번째를 고르면 선택되지 않게 하고 "최대 3개국까지 비교할 수 있습니다"라고 안내한다.

import { useState } from "react";
import CheckboxCard from "./CheckboxCard";
import {
  CORE_CRYPTO_TOPICS,
  CRYPTO_COUNTRIES,
  CRYPTO_COUNTRY_LABELS,
  CRYPTO_TOPICS,
  CRYPTO_TOPIC_LABELS,
  getCryptoSupportedList,
  type CryptoCountry,
  type CryptoTopic,
} from "@/lib/crypto-data";

// 한 번에 비교할 수 있는 국가 수
const MAX_COUNTRIES = 3;

// 지원하는 국가와 항목 목록 (안내 문구용)
const SUPPORTED = getCryptoSupportedList();

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

      {/* 비교표 자리: 24번에서 표로 바꾼다 */}
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        {countries.length === 0 || topics.length === 0
          ? "국가와 항목을 선택하세요"
          : `${countries.map((c) => CRYPTO_COUNTRY_LABELS[c]).join(", ")} · ${topics.length}개 항목을 골랐습니다. 비교표는 다음 단계에서 보여 드립니다.`}
      </p>
    </section>
  );
}
