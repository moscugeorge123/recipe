import { Link, useParams } from 'react-router-dom';

import { getImport } from '../api';
import { EmptyState, ErrorState, LoadingState, ShareBar, StatusText } from '../components/ui';
import { formatDuration, formatTokens, formatUsd, stageLabel } from '../format';
import { displayTitle, formatError, providerLabel, sourceLabel } from '../text';
import type { ThirdPartyCharge } from '../types';
import { useQuery } from '../use-query';

export function ImportDetailPage() {
  const { jobId = '' } = useParams();
  const query = useQuery(() => getImport(jobId), `import:${jobId}`);

  if (query.status === 'error') {
    return (
      <>
        <ErrorState message={query.message} onRetry={query.retry} />
        <p className="back-link">
          <Link to="/imports">Back to imports</Link>
        </p>
      </>
    );
  }
  if (query.status !== 'ready') return <LoadingState label="Loading import…" />;

  const detail = query.data;
  const jobError = formatError(detail.error);
  const providers = providerNames(detail.thirdParty);

  return (
    <>
      <header className="page-header">
        <p className="page-kicker">{sourceLabel(detail.sourceType)}</p>
        <h1>{displayTitle(detail.title)}</h1>
        {detail.description ? <p className="page-lede">{detail.description}</p> : null}
        <p className="job-id">
          Job <span className="num">{detail.jobId}</span>
        </p>
      </header>

      <dl className="meta">
        <div>
          <dt>Source</dt>
          <dd>{sourceLabel(detail.sourceType)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusText status={detail.status} />
          </dd>
        </div>
        <div>
          <dt>Total time</dt>
          <dd className="num">{formatDuration(detail.totalDurationMs)}</dd>
        </div>
        <div className="meta-wide">
          <dt>Source URL</dt>
          <dd>
            <a className="external" href={detail.sourceUrl} target="_blank" rel="noreferrer">
              {detail.sourceUrl}
            </a>
          </dd>
        </div>
      </dl>

      <section className="cost-strip" aria-label="Cost breakdown">
        <div>
          <span>AI</span>
          <strong className="money">{formatUsd(detail.costs.aiUsd)}</strong>
        </div>
        <div>
          <span>Third-party</span>
          <strong className="money">{formatUsd(detail.costs.thirdPartyUsd)}</strong>
          {providers ? <em>{providers}</em> : null}
        </div>
        <div>
          <span>Total</span>
          <strong className="money">{formatUsd(detail.costs.totalUsd)}</strong>
        </div>
      </section>

      <p className="back-link">
        <Link to={`/logs?jobId=${encodeURIComponent(detail.jobId)}`}>Logs for this import</Link>
      </p>

      {jobError ? (
        <p className="banner" role="alert">
          {jobError}
        </p>
      ) : null}

      <section className="section" aria-labelledby="steps-heading">
        <h2 id="steps-heading">Import steps</h2>
        <ol className="steps">
          {detail.steps.map((step) => {
            const stepError = formatError(step.error);
            const slowest = detail.slowestStep === step.stage;
            return (
              <li key={step.stage} className="step">
                <div className="step-top">
                  <span className="step-name">
                    {stageLabel(step.stage)}
                    {slowest ? <span className="slowest">Slowest</span> : null}
                  </span>
                  <StatusText status={step.status} />
                  <span className="num">{formatDuration(step.durationMs)}</span>
                </div>
                <ShareBar
                  share={step.shareOfTotal}
                  label={`${stageLabel(step.stage)} took ${Math.round(step.shareOfTotal * 100)} percent of this import`}
                />
                {stepError ? <p className="step-error">{stepError}</p> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="split">
        <section className="section" aria-labelledby="models-heading">
          <h2 id="models-heading">Models</h2>
          {detail.aiByModel.length === 0 ? (
            <EmptyState>No model usage recorded.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table aria-labelledby="models-heading">
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
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.aiByModel.map((model) => (
                    <tr key={`${model.provider}-${model.model}`}>
                      <th scope="row">
                        {model.model}
                        <span className="cell-sub">{providerLabel(model.provider)}</span>
                      </th>
                      <td className="num">{formatTokens(model.calls)}</td>
                      <td className="num">{formatTokens(model.inputTokens)}</td>
                      <td className="num">{formatTokens(model.outputTokens)}</td>
                      <td className="num money">{formatUsd(model.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="third-heading">
          <h2 id="third-heading">Third-party</h2>
          {detail.thirdParty.length === 0 ? (
            <EmptyState>No third-party calls recorded.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table aria-labelledby="third-heading">
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    <th scope="col">Operation</th>
                    <th scope="col" className="num">
                      Units
                    </th>
                    <th scope="col" className="num">
                      Time
                    </th>
                    <th scope="col" className="num">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.thirdParty.map((charge) => (
                    <tr key={charge.id}>
                      <th scope="row">{providerLabel(charge.provider)}</th>
                      <td>{stageLabel(charge.operation)}</td>
                      <td className="num">{formatTokens(charge.units)}</td>
                      <td className="num">{formatDuration(charge.durationMs)}</td>
                      <td className="num money">{formatUsd(charge.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function providerNames(charges: readonly ThirdPartyCharge[]): string {
  const names: string[] = [];
  for (const charge of charges) {
    const label = providerLabel(charge.provider);
    if (!names.includes(label)) names.push(label);
  }
  return names.join(', ');
}
