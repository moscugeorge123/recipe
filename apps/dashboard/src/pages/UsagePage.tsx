import type { ReactNode } from 'react';

import { getUsage } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, ShareBar } from '../components/ui';
import { formatDuration, formatTokens, formatUsd, stageLabel } from '../format';
import { providerLabel } from '../text';
import { useQuery } from '../use-query';

export function UsagePage() {
  const query = useQuery(getUsage, 'usage');

  if (query.status === 'error') return <ErrorState message={query.message} onRetry={query.retry} />;
  if (query.status !== 'ready') return <LoadingState label="Loading usage…" />;

  const report = query.data;
  const totalCost = report.totals.estimatedCostUsd;

  return (
    <>
      <PageHeader kicker="Usage" title="Tokens and what they cost" lede="Grouped by model, then by operation." />
      <section className="cost-strip" aria-label="Usage totals">
        <div>
          <span>Input tokens</span>
          <strong>{formatTokens(report.totals.inputTokens)}</strong>
        </div>
        <div>
          <span>Output tokens</span>
          <strong>{formatTokens(report.totals.outputTokens)}</strong>
        </div>
        <div>
          <span>AI cost</span>
          <strong className="money">{formatUsd(report.totals.estimatedCostUsd)}</strong>
        </div>
        <div>
          <span>Calls</span>
          <strong>{formatTokens(report.totals.calls)}</strong>
        </div>
      </section>

      <section className="section" aria-labelledby="models-usage-heading">
        <h2 id="models-usage-heading">Models</h2>
        {report.byModel.length === 0 ? (
          <EmptyState>No model usage recorded.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="usage-table" aria-labelledby="models-usage-heading">
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col" className="num">
                    Calls
                  </th>
                  <th scope="col" className="num">
                    Input tokens
                  </th>
                  <th scope="col" className="num">
                    Output tokens
                  </th>
                  <th scope="col" className="num">
                    Duration
                  </th>
                  <th scope="col" className="num">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.byModel.flatMap((model) => {
                  const share = totalCost > 0 ? model.estimatedCostUsd / totalCost : 0;
                  const rows: ReactNode[] = [
                    <tr key={`${model.provider}-${model.model}`} className="model-row">
                      <th scope="row">
                        <span className="model-name">{model.model}</span>
                        <span className="cell-sub">{providerLabel(model.provider)}</span>
                        <ShareBar
                          share={share}
                          label={`${model.model} is ${Math.round(share * 100)} percent of AI cost`}
                        />
                      </th>
                      <td className="num">{formatTokens(model.calls)}</td>
                      <td className="num">{formatTokens(model.inputTokens)}</td>
                      <td className="num">{formatTokens(model.outputTokens)}</td>
                      <td className="num">{formatDuration(model.durationMs)}</td>
                      <td className="num money">{formatUsd(model.estimatedCostUsd)}</td>
                    </tr>,
                  ];
                  for (const operation of model.operations) {
                    rows.push(
                      <tr key={`${model.provider}-${model.model}-${operation.operation}`} className="op-row">
                        <th scope="row">{stageLabel(operation.operation)}</th>
                        <td className="num">{formatTokens(operation.calls)}</td>
                        <td className="num">{formatTokens(operation.inputTokens)}</td>
                        <td className="num">{formatTokens(operation.outputTokens)}</td>
                        <td className="num">{formatDuration(operation.durationMs)}</td>
                        <td className="num money">{formatUsd(operation.estimatedCostUsd)}</td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
