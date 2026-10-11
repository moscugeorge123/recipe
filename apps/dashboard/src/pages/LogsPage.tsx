import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getLogs } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusText } from '../components/ui';
import { formatDuration, stageLabel } from '../format';
import { formatTimestamp } from '../text';
import type { LogEntry } from '../types';
import { useQuery } from '../use-query';

const LEVELS = ['all', 'info', 'warn', 'error'] as const;

function readLevel(value: string | null): (typeof LEVELS)[number] {
  if (value && LEVELS.some((level) => level === value)) return value as (typeof LEVELS)[number];
  return 'all';
}

export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const level = readLevel(params.get('level'));
  const qParam = params.get('q') ?? '';
  const jobParam = params.get('jobId') ?? '';
  const [q, setQ] = useState(qParam);
  const [jobId, setJobId] = useState(jobParam);
  const qFocused = useRef(false);
  const jobFocused = useRef(false);

  useEffect(() => {
    if (!qFocused.current) setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    if (!jobFocused.current) setJobId(jobParam);
  }, [jobParam]);

  const query = useQuery(
    () => getLogs({ page: 1, pageSize: 100, level, q, jobId }),
    `logs:${level}:${q}:${jobId}`,
  );

  function update(next: { level?: string; q?: string; jobId?: string }) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next.level !== undefined) {
          if (!next.level || next.level === 'all') updated.delete('level');
          else updated.set('level', next.level);
        }
        if (next.q !== undefined) {
          if (next.q === '') updated.delete('q');
          else updated.set('q', next.q);
        }
        if (next.jobId !== undefined) {
          if (next.jobId.trim() === '') updated.delete('jobId');
          else updated.set('jobId', next.jobId.trim());
        }
        return updated;
      },
      { replace: true },
    );
  }

  return (
    <>
      <PageHeader kicker="Logs" title="What the pipeline said" lede="Filter by level, message, or job." />
      <div className="toolbar">
        <label className="field">
          <span>Level</span>
          <select
            value={level}
            onChange={(event) => {
              update({ level: event.target.value });
            }}
          >
            {LEVELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-grow">
          <span>Search</span>
          <input
            type="search"
            value={q}
            placeholder="Message, step, or job"
            onFocus={() => {
              qFocused.current = true;
            }}
            onBlur={() => {
              qFocused.current = false;
            }}
            onChange={(event) => {
              setQ(event.target.value);
              update({ q: event.target.value });
            }}
          />
        </label>
        <label className="field">
          <span>Job</span>
          <input
            value={jobId}
            placeholder="job id"
            spellCheck={false}
            onFocus={() => {
              jobFocused.current = true;
            }}
            onBlur={() => {
              jobFocused.current = false;
            }}
            onChange={(event) => {
              setJobId(event.target.value);
              update({ jobId: event.target.value });
            }}
          />
        </label>
        <button type="button" className="button" onClick={query.retry}>
          Refresh
        </button>
      </div>

      {query.status === 'error' ? <ErrorState message={query.message} onRetry={query.retry} /> : null}
      {query.status === 'loading' ? <LoadingState label="Loading logs…" /> : null}
      {query.status === 'ready' ? <LogList entries={query.data.data} total={query.data.meta.total} /> : null}
    </>
  );
}

function LogList({ entries, total }: { entries: LogEntry[]; total: number }) {
  const ordered = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (ordered.length === 0) {
    return <EmptyState>No log lines match these filters.</EmptyState>;
  }

  return (
    <>
      <p className="result-count">
        {ordered.length === total ? `${total} lines` : `Showing ${ordered.length} of ${total}`}
      </p>
      <ol className="log-list">
        {ordered.map((entry, index) => (
          <li key={`${entry.timestamp}-${entry.msg}-${index}`} className="log-row">
            <span className="num log-time">{formatTimestamp(entry.timestamp)}</span>
            <StatusText status={entry.level} />
            <div className="log-body">
              <p className="log-msg">{entry.msg}</p>
              <p className="log-meta">
                {entry.step ? <span>{stageLabel(entry.step)}</span> : null}
                {typeof entry.durationMs === 'number' ? <span className="num">{formatDuration(entry.durationMs)}</span> : null}
                {entry.jobId ? (
                  <Link to={`/imports/${encodeURIComponent(entry.jobId)}`}>{entry.jobId}</Link>
                ) : null}
                {entry.service ? <span>{entry.service}</span> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
