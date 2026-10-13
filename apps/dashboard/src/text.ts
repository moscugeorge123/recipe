import { stageLabel } from './format';

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  generic_web: 'Generic web',
  'generic-web': 'Generic web',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  apify: 'Apify',
  'yt-dlp': 'yt-dlp',
  ytdlp: 'yt-dlp',
};

export function sourceLabel(sourceType: string): string {
  return SOURCE_LABELS[sourceType.toLowerCase()] ?? stageLabel(sourceType);
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

export function displayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : 'Untitled import';
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
  return `${formatted} UTC`;
}

export function formatError(error: unknown): string | null {
  if (error == null) return null;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const trimmed = error.message.trim();
    return trimmed ? trimmed : null;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function statusTone(
  status: string,
): 'completed' | 'failed' | 'running' | 'pending' | 'info' | 'warn' {
  const value = status.toUpperCase();
  if (value === 'COMPLETED') return 'completed';
  if (value === 'FAILED' || value === 'ERROR') return 'failed';
  if (value === 'WARN' || value === 'WARNING') return 'warn';
  if (value === 'INFO') return 'info';
  if (value === 'PENDING' || value === 'QUEUED' || value === 'SKIPPED' || value === 'CANCELLED') {
    return 'pending';
  }
  return 'running';
}

export function shareWidth(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  return `${Math.min(100, share * 100)}%`;
}
