import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

export interface LogQuery {
  level?: string;
  jobId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  msg: string;
  service?: string;
  jobId?: string;
  step?: string;
  durationMs?: number;
  requestId?: string;
}

export interface LogReader {
  read(query: LogQuery): Promise<{ entries: LogEntry[]; total: number }>;
}

const MAX_BYTES_PER_FILE = 1_500_000;
const MAX_FILES = 14;

const PINO_LEVELS: Readonly<Record<number, string>> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function readLevel(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Object.hasOwn(PINO_LEVELS, value)) {
    return PINO_LEVELS[value] ?? String(value);
  }
  return '';
}

function readTimestamp(record: Record<string, unknown>): string | null {
  const raw = record['time'] ?? record['timestamp'];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  return null;
}

function toLogEntry(record: Record<string, unknown>): LogEntry | null {
  const timestamp = readTimestamp(record);
  if (timestamp === null) {
    return null;
  }

  const entry: LogEntry = {
    timestamp,
    level: readLevel(record['level']),
    msg: typeof record['msg'] === 'string' ? record['msg'] : '',
  };

  if (typeof record['service'] === 'string') {
    entry.service = record['service'];
  }
  if (typeof record['jobId'] === 'string') {
    entry.jobId = record['jobId'];
  }
  if (typeof record['step'] === 'string') {
    entry.step = record['step'];
  }
  if (typeof record['durationMs'] === 'number' && Number.isFinite(record['durationMs'])) {
    entry.durationMs = record['durationMs'];
  }
  if (typeof record['requestId'] === 'string') {
    entry.requestId = record['requestId'];
  }

  return entry;
}

function parseLogContents(contents: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const entry = toLogEntry(parsed);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  return entries;
}

async function readLogTail(filePath: string): Promise<string | null> {
  try {
    const handle = await open(filePath, 'r');
    try {
      const info = await handle.stat();
      if (!info.isFile()) {
        return null;
      }
      const start = info.size > MAX_BYTES_PER_FILE ? info.size - MAX_BYTES_PER_FILE : 0;
      const length = info.size - start;
      if (length === 0) {
        return '';
      }
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      let text = buffer.toString('utf8');
      if (start > 0) {
        const newline = text.indexOf('\n');
        text = newline === -1 ? '' : text.slice(newline + 1);
      }
      return text;
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

async function listLogFiles(directory: string): Promise<string[]> {
  let dirents;
  try {
    dirents = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  let root: string;
  try {
    root = await realpath(directory);
  } catch {
    return [];
  }

  const found: { filePath: string; mtimeMs: number }[] = [];
  const seen = new Set<string>();

  for (const dirent of dirents) {
    if (!dirent.name.endsWith('.log') || dirent.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directory, dirent.name);
    try {
      const info = await lstat(entryPath);
      let filePath = entryPath;
      let mtimeMs = info.mtimeMs;

      if (info.isSymbolicLink()) {
        const target = await realpath(entryPath);
        if (!isInsideDirectory(root, target)) {
          continue;
        }
        const targetInfo = await lstat(target);
        if (!targetInfo.isFile()) {
          continue;
        }
        filePath = target;
        mtimeMs = targetInfo.mtimeMs;
      } else if (!info.isFile()) {
        continue;
      }

      const resolved = await realpath(filePath);
      if (!isInsideDirectory(root, resolved) || seen.has(resolved)) {
        continue;
      }
      seen.add(resolved);
      found.push({ filePath: resolved, mtimeMs });
    } catch {
      continue;
    }
  }

  found.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return found.slice(0, MAX_FILES).map((file) => file.filePath);
}

function timestampValue(timestamp: string): number {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? 0 : value;
}

function matchesQuery(entry: LogEntry, query: LogQuery): boolean {
  if (query.level !== undefined && query.level.length > 0) {
    if (entry.level.toLowerCase() !== query.level.toLowerCase()) {
      return false;
    }
  }

  if (query.jobId !== undefined && query.jobId.length > 0 && entry.jobId !== query.jobId) {
    return false;
  }

  if (query.q !== undefined && query.q.length > 0) {
    const needle = query.q.toLowerCase();
    const haystacks = [entry.msg, entry.step, entry.jobId];
    const matched = haystacks.some(
      (value) => value !== undefined && value.toLowerCase().includes(needle),
    );
    if (!matched) {
      return false;
    }
  }

  return true;
}

export class FileLogReader implements LogReader {
  constructor(private readonly directory: string | undefined) {}

  async read(query: LogQuery): Promise<{ entries: LogEntry[]; total: number }> {
    if (this.directory === undefined || this.directory.length === 0) {
      return { entries: [], total: 0 };
    }

    const files = await listLogFiles(this.directory);
    const parsed: LogEntry[] = [];
    for (const filePath of files) {
      const contents = await readLogTail(filePath);
      if (contents === null || contents.length === 0) {
        continue;
      }
      parsed.push(...parseLogContents(contents));
    }

    const matched = parsed.filter((entry) => matchesQuery(entry, query));
    matched.sort((left, right) => timestampValue(right.timestamp) - timestampValue(left.timestamp));

    const start = Math.max(0, (query.page - 1) * query.pageSize);
    return {
      entries: matched.slice(start, start + query.pageSize),
      total: matched.length,
    };
  }
}
