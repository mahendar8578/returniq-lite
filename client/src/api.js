const BASE = import.meta.env.VITE_API_URL || '';
async function call(path, method = 'GET', body) {
  let res;
  try {
    res = await fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Cannot reach the server. Is the API running?'); }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.map(e => e.msg).join('. ') || data?.message || 'Request failed');
  return data;
}
export const api = {
  get: p => call(p), post: (p, b) => call(p, 'POST', b), put: (p, b) => call(p, 'PUT', b), del: p => call(p, 'DELETE')
};
export const REASONS = ['Defective', 'Wrong item sent', 'Not as described', 'Damaged in shipping', 'Size or fit', 'Changed mind', 'Late delivery', 'Other'];
