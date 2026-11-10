export function cleanFilters(params = {}) {
  return Object.fromEntries(Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => [key, String(value).trim()]));
}

async function requestJson(url, { signal } = {}, resource = 'properties') {
  let response;
  try {
    response = await fetch(url, {
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
      `Unable to load ${resource} (HTTP ${response.status}). Please try again.`);
  }
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error :
      `Unable to load ${resource} (HTTP ${response.status}). Please try again.`);
  }
  return data;
}

export async function fetchProperties(params = {}, options = {}) {
  const query = new URLSearchParams(cleanFilters(params)).toString();
  const data = await requestJson(`/api/properties${query ? `?${query}` : ''}`, options);
  if (!Array.isArray(data?.results) || !Number.isInteger(data.total) || data.total < 0) {
    throw new Error('The property service returned an invalid response.');
  }
  return data;
}

export async function fetchPropertyDetail(id, options = {}) {
  // Keep IDs as strings so leading zeros survive the request.
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(id)) {
    throw new Error('Listing ID must contain 1–255 letters, digits, underscores, or hyphens');
  }
  const data = await requestJson(`/api/properties/${encodeURIComponent(id)}`, options, 'property details');
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.L_ListingID !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(data.L_ListingID)) {
    throw new Error('The property service returned an invalid response.');
  }
  return data;
}
