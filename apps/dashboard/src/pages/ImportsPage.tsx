import { Link } from 'react-router-dom';

import { getImports } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusText } from '../components/ui';
import { formatDuration, formatUsd, stageLabel } from '../format';
import { displayTitle, sourceLabel } from '../text';
import type { ImportListItem } from '../types';
import { useQuery } from '../use-query';

export function ImportsPage() {
  const query = useQuery(() => getImports(1, 50), 'imports');

  if (query.status === 'error') return <ErrorState message={query.message} onRetry={query.retry} />;
  if (query.status !== 'ready') return <LoadingState label="Loading imports…" />;

  const rows = [...query.data.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        kicker="Imports"
        title="Every recipe in the ledger"
        lede={`${query.data.meta.total} import${query.data.meta.total === 1 ? '' : 's'}`}
      />
      {rows.length === 0 ? (
        <EmptyState>No imports yet.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="imports">
            <thead>
              <tr>
                <th scope="col">Recipe</th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Steps
                </th>
                <th scope="col" className="num">
                  Time
                </th>
                <th scope="col" className="num">
                  AI cost
                </th>
                <th scope="col" className="num">
                  Third-party cost
                </th>
                <th scope="col" className="num">
                  Total cost
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <ImportRow key={item.jobId} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ImportRow({ item }: { item: ImportListItem }) {
  const title = displayTitle(item.title);
  const label = [
    title,
    sourceLabel(item.sourceType),
    stageLabel(item.status),
    `${item.completedStepCount} of ${item.stepCount} steps`,
    formatDuration(item.totalDurationMs),
    `total ${formatUsd(item.costs.totalUsd)}`,
  ].join(', ');

  return (
    <tr>
      <th scope="row">
        <Link className="row-link" to={`/imports/${item.jobId}`} aria-label={label}>
          {title}
        </Link>
      </th>
      <td>{sourceLabel(item.sourceType)}</td>
      <td>
        <StatusText status={item.status} />
      </td>
      <td className="num">
        {item.completedStepCount}/{item.stepCount}
        {item.failedStepCount > 0 ? (
          <span className="fail-note"> · {item.failedStepCount} failed</span>
        ) : null}
      </td>
      <td className="num">{formatDuration(item.totalDurationMs)}</td>
      <td className="num money">{formatUsd(item.costs.aiUsd)}</td>
      <td className="num money">{formatUsd(item.costs.thirdPartyUsd)}</td>
      <td className="num money">{formatUsd(item.costs.totalUsd)}</td>
    </tr>
  );
}
