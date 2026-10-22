// 체크박스 한 칸. 세율 비교와 가상자산 비교의 국가·항목 선택이 같은 모양을 쓴다.
export default function CheckboxCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 break-keep sm:gap-3 sm:px-4 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950">
      <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
