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
