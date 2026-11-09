export function firstPhoto(value) {
  try {
    const photos = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(photos) || typeof photos[0] !== 'string') return null;
    const url = new URL(photos[0]);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function numberLabel(value, fallback = '—') {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number.toLocaleString('en-US') : fallback;
}

export function priceLabel(value) {
  return Number(value) > 0 && Number.isFinite(Number(value))
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : 'Price upon request';
}
