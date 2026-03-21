const CURRENCY_MAP = { USA: 'USD', UK: 'GBP', Australia: 'AUD', Canada: 'CAD' };

export function fmtFull(n, country = 'USA') {
  if (!n || isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY_MAP[country] ?? 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function fmtCompact(n, country = 'USA') {
  if (!n || isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY_MAP[country] ?? 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n));
}

export function fmtNum(n) {
  if (!n || isNaN(Number(n))) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n));
}

export function fmtInt(n) {
  if (!n || isNaN(Number(n))) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(Number(n)));
}
