import Link from 'next/link';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { config } from '@/lib/config';
import { latestDecisionByChange } from '@/lib/db';
import { listChanges } from '@/lib/openspec';
import { getRuntimeDiagnostics } from '@/lib/runtime-diagnostics';
import { DecisionBadge } from '@/app/components/DecisionBadge';
import { EventStatus } from '@/app/components/EventStatus';

export const runtime = 'nodejs';

export default function HomePage(): React.ReactElement {
  ensureBootstrapped();
  const latest = latestDecisionByChange();
  const changes = listChanges();
  const diagnostics = getRuntimeDiagnostics();
  const errors = diagnostics.filter((d) => d.level === 'error');
  const warnings = diagnostics.filter((d) => d.level === 'warning');

  return (
    <div className="grid">
      <div className="card">
        <h1>Changes Dashboard</h1>
        <p className="muted">
          Reviewing <code>{config.openspecRoot}/changes/*</code>. Total changes: {changes.length}
        </p>
        <EventStatus />
      </div>

      {diagnostics.length > 0 ? (
        <div className="card">
          <h3>Environment Diagnostics</h3>
          {errors.map((issue) => (
            <p key={issue.code} className="diag error">
              {issue.message}
            </p>
          ))}
          {warnings.map((issue) => (
            <p key={issue.code} className="diag warning">
              {issue.message}
            </p>
          ))}
          <p className="muted">
            Run <code>npm run doctor</code> to validate environment variables from CLI.
          </p>
        </div>
      ) : null}

      {changes.length === 0 ? (
        <div className="card">
          <p>
            No changes found. Add folders under <code>{config.openspecRoot}/changes/</code>.
          </p>
        </div>
      ) : null}

      {changes.map((change) => (
        <div key={change.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <Link href={`/changes/${change.id}`}>
              <strong>{change.title}</strong>
            </Link>
            <DecisionBadge decision={latest[change.id]} />
          </div>
          <p className="muted">
            {change.id} • {change.artifactCount} artifacts • updated {new Date(change.updatedAt).toLocaleString()}
          </p>
          <p className="muted">{change.path}</p>
        </div>
      ))}
    </div>
  );
}
