import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

export default async function SpecRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ changeId: string }>;
  searchParams: Promise<{ projectId?: string; doc?: string }>;
}): Promise<never> {
  const { changeId } = await params;
  const { projectId, doc } = await searchParams;
  const qs = new URLSearchParams();
  if (projectId) qs.set('projectId', projectId);
  if (doc) qs.set('doc', doc);
  redirect(`/review/${changeId}?${qs.toString()}`);
}
