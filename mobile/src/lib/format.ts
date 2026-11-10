// Number and money formatting (Armenian dram, grouped like the website: "12,500 ֏").
const group = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const money = (n: number | null | undefined) => `${(n ?? 0) < 0 ? '−' : ''}${group(n ?? 0)} ֏`;
export const points = (n: number | null | undefined) => `${(n ?? 0) < 0 ? '−' : ''}${group(n ?? 0)}`;
export const signedPoints = (n: number) => `${n >= 0 ? '+' : '−'}${group(n)}`;

/** "1234 5678" while typing an 8-digit Pioneer card number. */
export const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{4})(\d)/, '$1 $2');
