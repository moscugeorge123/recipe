import type { ReactNode } from 'react';

import { stageLabel } from '../format';
import { shareWidth, statusTone } from '../text';

export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede?: ReactNode;
}) {
  return (
    <header className="page-header">
      <p className="page-kicker">{kicker}</p>
      <h1>{title}</h1>
      {lede ? <div className="page-lede">{lede}</div> : null}
    </header>
  );
}

export function StatusText({ status }: { status: string }) {
  return <span className={`status status-${statusTone(status)}`}>{stageLabel(status)}</span>;
}

export function LoadingState({ label = 'Loading the ledger…' }: { label?: string }) {
  return (
    <p className="state" role="status">
      {label}
    </p>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state" role="alert">
      <p>{message}</p>
      <button type="button" className="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function ShareBar({ share, label }: { share: number; label: string }) {
  return (
    <div className="track" role="img" aria-label={label}>
      <span style={{ width: shareWidth(share) }} />
    </div>
  );
}
