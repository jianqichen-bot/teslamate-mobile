export function formatAmount(amount: number | null, unit = "", maximumFractionDigits = 1) {
  return amount === null ? "—" : `${amount.toLocaleString("zh-CN", { maximumFractionDigits })}${unit}`;
}
