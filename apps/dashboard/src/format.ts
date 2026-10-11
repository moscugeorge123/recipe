const ACRONYMS = new Set(['ocr', 'ai', 'api', 'url']);

export function formatUsd(n: number): string {
  if (n === 0) return '$0.00';
  const digits = Math.abs(n) < 0.01 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Ledger precision is 6 decimal places. Keeps sub-cent amounts visible. */
export function formatUsdExact(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  const negative = n < 0;
  const scaled = Math.round(Math.abs(n) * 1_000_000);
  if (scaled === 0) return '$0.00';

  const whole = Math.floor(scaled / 1_000_000);
  const fraction = String(scaled % 1_000_000)
    .padStart(6, '0')
    .replace(/0+$/, '')
    .padEnd(2, '0');
  const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(whole);
  return `${negative ? '-' : ''}$${grouped}.${fraction}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms) || ms < 0) return '—';

  const wholeMs = Math.round(ms);
  if (wholeMs < 1000) return `${wholeMs} ms`;

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    if (totalSeconds < 10) return `${totalSeconds.toFixed(1)}s`;
    const rounded = Math.round(totalSeconds);
    if (rounded >= 60) return '1m 0s';
    return `${rounded}s`;
  }

  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.round(totalSeconds - minutes * 60);
  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }
  return `${minutes}m ${seconds}s`;
}

export function stageLabel(stage: string): string {
  const words = stage.toLowerCase().split(/[_\s-]+/).filter(Boolean);
  if (words.length === 0) return stage;
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word)) return word.toUpperCase();
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(' ');
}

export function formatTokens(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}
