import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

export default async function ChangesRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string; tab?: string }>;
}): Promise<never> {
  const { id } = await params;
  const { projectId, tab } = await searchParams;
  const qs = new URLSearchParams();
  if (projectId) qs.set('projectId', projectId);
  if (tab) qs.set('doc', tab);
  redirect(`/review/${id}?${qs.toString()}`);
}
