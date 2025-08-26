export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function toTitleCase(str = '') {
  return str
    .toLowerCase()
    .replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
}

export const dedupeBy = (arr, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

export function isLikelyJacksonville(text = '') {
  return /(jacksonville|duval|st\.?\s*johns|orange park|ponte vedra|nocatee)/i.test(text);
}

export const PHONE_RE = /(?:\+1[\s.-]?)?(?:\(?(\d{3})\)?[\s.-]?)(\d{3})[\s.-]?(\d{4})/g;
export const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,11)}`;
  }
  if (digits.length < 10) return null;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

export function toE164US(p) {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  if (digits.length == 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 10) return '+1' + digits.slice(-10);
  return '';
}

export function splitName(name='') {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
