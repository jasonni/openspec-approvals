'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SearchHit } from '@/lib/types';

export function SearchClient({ projectId }: { projectId: string }): React.ReactElement {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const key = hit.changeId;
      const prev = map.get(key) ?? [];
      prev.push(hit);
      map.set(key, prev);
    }
    return Array.from(map.entries());
  }, [hits]);

  async function runSearch(): Promise<void> {
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(
      `/api/search?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}`
    );
    const data = (await res.json()) as { hits: SearchHit[] };
    setHits(data.hits ?? []);
    setLoading(false);
  }

  return (
    <div className="grid">
      <div className="card">
        <h1>Semantic Search</h1>
        <p className="muted">
          Project <code>{projectId}</code> - search across proposal/design/tasks/spec artifacts.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Search requirements, scenarios, tasks..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
          />
          <button className="primary" onClick={runSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {grouped.map(([changeId, changeHits]) => (
        <div className="card" key={changeId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <strong>{changeId}</strong>
            <Link href={`/changes/${changeId}?projectId=${encodeURIComponent(projectId)}`}>Open Change</Link>
          </div>
          <div className="grid" style={{ marginTop: 8 }}>
            {changeHits.map((hit, idx) => (
              <div
                key={`${changeId}-${idx}`}
                style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}
              >
                <p className="muted">
                  {hit.artifactType} • score {hit.score.toFixed(3)}
                </p>
                <p>{hit.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
