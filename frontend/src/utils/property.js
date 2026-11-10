export function parsePhotos(value) {
  try {
    const photos = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(photos)) return [];
    return photos.flatMap(photo => {
      if (typeof photo !== 'string') return [];
      try {
        const url = new URL(photo);
        return ['https:', 'http:'].includes(url.protocol) ? [url.href] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
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
