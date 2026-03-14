import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  createInlineComment,
  listInlineComments,
} from '@/lib/db';
import { getProject } from '@/lib/projects';
import type { ArtifactType } from '@/lib/types';

export const runtime = 'nodejs';

function isArtifactType(v: string): v is ArtifactType {
  return ['proposal', 'design', 'tasks', 'spec'].includes(v);
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId')?.trim();
  const changeId = searchParams.get('changeId')?.trim();
  if (!projectId || !changeId) {
    return NextResponse.json({ error: 'projectId and changeId are required' }, { status: 400 });
  }
  if (!getProject(projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${projectId}` }, { status: 404 });
  }
  const artifactType = searchParams.get('artifactType')?.trim() ?? undefined;
  const comments = listInlineComments(
    projectId,
    changeId,
    artifactType && isArtifactType(artifactType) ? artifactType : undefined
  );
  return NextResponse.json({ comments });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as {
    projectId?: string;
    changeId?: string;
    artifactType?: string;
    paragraphId?: string;
    selectedText?: string;
    author?: string;
    body?: string;
    parentId?: string;
  };

  if (!body.projectId || !body.changeId || !body.artifactType || !body.paragraphId || !body.body) {
    return NextResponse.json(
      { error: 'projectId, changeId, artifactType, paragraphId and body are required' },
      { status: 400 }
    );
  }
  if (!getProject(body.projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${body.projectId}` }, { status: 404 });
  }
  if (!isArtifactType(body.artifactType)) {
    return NextResponse.json({ error: 'Invalid artifactType' }, { status: 400 });
  }

  const id = randomUUID();
  createInlineComment({
    id,
    projectId: body.projectId,
    changeId: body.changeId,
    artifactType: body.artifactType,
    paragraphId: body.paragraphId,
    selectedText: body.selectedText ?? '',
    author: body.author ?? 'reviewer',
    body: body.body,
    parentId: body.parentId ?? null,
  });

  const comments = listInlineComments(body.projectId, body.changeId, body.artifactType);
  return NextResponse.json({ id, comments }, { status: 201 });
}
