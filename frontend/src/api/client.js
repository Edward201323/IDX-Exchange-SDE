export function cleanFilters(params = {}) {
  return Object.fromEntries(Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => [key, String(value).trim()]));
}

export async function fetchProperties(params = {}, { signal } = {}) {
  const query = new URLSearchParams(cleanFilters(params)).toString();
  let response;
  try {
    response = await fetch(`/api/properties${query ? `?${query}` : ''}`, {
      signal, headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the property service. Please try again.');
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(response.ok ? 'The property service returned an invalid response.' :
      `Unable to load properties (HTTP ${response.status}). Please try again.`);
  }
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error :
      `Unable to load properties (HTTP ${response.status}). Please try again.`);
  }
  if (!Array.isArray(data?.results) || !Number.isInteger(data.total) || data.total < 0) {
    throw new Error('The property service returned an invalid response.');
  }
  return data;
}
