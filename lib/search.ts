import { embed, cosineSimilarity } from '@/lib/embed';
import { listIndexedDocuments } from '@/lib/db';
import type { SearchHit } from '@/lib/types';

function snippet(content: string, query: string): { text: string; location: number } {
  const q = query.toLowerCase().trim();
  const idx = q ? content.toLowerCase().indexOf(q) : -1;
  const at = idx >= 0 ? idx : 0;
  const start = Math.max(0, at - 120);
  const end = Math.min(content.length, at + 180);
  return {
    text: content.slice(start, end).replace(/\n+/g, ' ').trim(),
    location: at,
  };
}

export function searchDocuments(projectId: string, query: string, limit = 20): SearchHit[] {
  const docs = listIndexedDocuments(projectId);
  if (!query.trim()) return [];
  const qVec = embed(query);

  const hits = docs.map((doc) => {
    const vector = JSON.parse(doc.embedding) as number[];
    const score = cosineSimilarity(qVec, vector);
    const sn = snippet(doc.content, query);
    return {
      projectId,
      changeId: doc.changeId,
      artifactType: doc.artifactType,
      path: doc.path,
      snippet: sn.text,
      score,
      location: sn.location,
    };
  });

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
