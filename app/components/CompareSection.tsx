"use client";

// Design Ref: §2 — ② 비교하기. 국가 선택과 항목 선택을 만들었고, 비교표는 이후 작업에서 추가한다.
// Plan SC: 4번째 국가를 고르려 하면 선택되지 않게 하고 "최대 3개국까지 비교할 수 있습니다"라고 안내한다.

import { useState } from "react";
import { COUNTRIES, COUNTRY_LABELS, ITEMS, ITEM_LABELS, type Country, type Item } from "@/lib/tax-data";

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
    </section>
  );
}
