import { Link } from 'react-router-dom';

import { getImports, getSummary } from '../api';
import { ErrorState, LoadingState, PageHeader, ShareBar, StatusText } from '../components/ui';
import { formatDuration, formatTokens, formatUsd, stageLabel } from '../format';
import { displayTitle, sourceLabel } from '../text';
import type { DashboardSummary, ImportListItem } from '../types';
import { useQuery } from '../use-query';

export function OverviewPage() {
  const summaryQuery = useQuery(getSummary, 'summary');
  const importsQuery = useQuery(() => getImports(1, 50), 'imports');

  if (summaryQuery.status === 'error') {
    return <ErrorState message={summaryQuery.message} onRetry={summaryQuery.retry} />;
  }
  if (importsQuery.status === 'error') {
    return <ErrorState message={importsQuery.message} onRetry={importsQuery.retry} />;
  }
  if (summaryQuery.status !== 'ready' || importsQuery.status !== 'ready') {
    return <LoadingState />;
  }

  const summary = summaryQuery.data;
  const recent = [...importsQuery.data.data]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const slowestAverage = Math.max(0, ...summary.slowestSteps.map((step) => step.averageDurationMs));

  return (
    <>
      <PageHeader
        kicker="Overview"
        title="The import desk"
        lede={`${summary.jobs.total} jobs · ${summary.jobs.completed} completed · ${summary.jobs.failed} failed`}
      />
      <section className="stats" aria-label="Ledger totals">
        <Stat label="Imported recipes" value={formatTokens(summary.importedRecipes)} />
        <Stat label="In progress" value={formatTokens(summary.jobs.inProgress)} detail="jobs" />
        <Stat label="AI cost" value={formatUsd(summary.costs.aiUsd)} money />
        <Stat label="Third-party cost" value={formatUsd(summary.costs.thirdPartyUsd)} money />
        <Stat label="Total cost" value={formatUsd(summary.costs.totalUsd)} money />
        <article className="stat">
          <span className="stat-label">Tokens</span>
          <p className="stat-value">
            <span className="num">{formatTokens(summary.tokens.input)}</span>
            <span className="stat-unit">in</span>
          </p>
          <p className="stat-sub">
            <span className="num">{formatTokens(summary.tokens.output)}</span> out
          </p>
        </article>
      </section>

      <section className="section" aria-labelledby="slowest-heading">
        <h2 id="slowest-heading">Slowest steps</h2>
        <SlowestTable summary={summary} slowestAverage={slowestAverage} />
      </section>

      <section className="section" aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recent imports</h2>
        {recent.length === 0 ? (
          <p className="empty">No imports yet.</p>
        ) : (
          <div className="recent-list">
            {recent.map((item) => (
              <RecentRow key={item.jobId} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  money = false,
}: {
  label: string;
  value: string;
  detail?: string;
  money?: boolean;
}) {
  return (
    <article className="stat">
      <span className="stat-label">{label}</span>
      <p className={money ? 'stat-value money' : 'stat-value'}>{value}</p>
      {detail ? <p className="stat-sub">{detail}</p> : <p className="stat-sub">&nbsp;</p>}
    </article>
  );
}

function SlowestTable({
  summary,
  slowestAverage,
}: {
  summary: DashboardSummary;
  slowestAverage: number;
}) {
  if (summary.slowestSteps.length === 0) {
    return <p className="empty">No finished steps yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="slow-table" aria-labelledby="slowest-heading">
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col" className="num">
              Average
            </th>
            <th scope="col" className="num">
              Max
            </th>
            <th scope="col" className="num">
              Samples
            </th>
            <th scope="col">Vs slowest</th>
          </tr>
        </thead>
        <tbody>
          {summary.slowestSteps.map((step) => {
            const share = slowestAverage > 0 ? step.averageDurationMs / slowestAverage : 0;
            return (
              <tr key={step.stage}>
                <th scope="row">{stageLabel(step.stage)}</th>
                <td className="num">{formatDuration(step.averageDurationMs)}</td>
                <td className="num">{formatDuration(step.maxDurationMs)}</td>
                <td className="num">{formatTokens(step.sampleCount)}</td>
                <td className="bar-cell">
                  <ShareBar
                    share={share}
                    label={`${stageLabel(step.stage)} average is ${Math.round(share * 100)} percent of the slowest average`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentRow({ item }: { item: ImportListItem }) {
  return (
    <Link className="recent" to={`/imports/${item.jobId}`}>
      <span className="recent-title">{displayTitle(item.title)}</span>
      <span className="recent-source">{sourceLabel(item.sourceType)}</span>
      <StatusText status={item.status} />
      <span className="num money">{formatUsd(item.costs.totalUsd)}</span>
      <span className="num">{formatDuration(item.totalDurationMs)}</span>
    </Link>
  );
}
