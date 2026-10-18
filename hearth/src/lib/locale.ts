/** UK only at launch (R38). Currency, units and copy locale live here so other markets are config. */
export const LOCALE = 'en-GB';
export const CURRENCY = 'GBP';

const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const moneyExact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });

export function formatPrice(pence: number | null | undefined, exact = false): string {
  if (pence == null) return '';
  const pounds = pence / 100;
  return (exact || pounds % 1 !== 0 ? moneyExact : money).format(pounds);
}

export function formatCm(cm: number | null | undefined): string {
  return cm == null ? '' : `${Math.round(cm)} cm`;
}

export function formatDimensions(
  w?: number | null,
  d?: number | null,
  h?: number | null,
): string | null {
  const parts = [w, d, h].filter((n): n is number => n != null).map((n) => Math.round(n));
  return parts.length ? `${parts.join(' × ')} cm` : null;
}
