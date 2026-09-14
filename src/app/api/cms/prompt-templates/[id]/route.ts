import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { z } from 'zod';

const UpdateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isQuickSubmit: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existing = store.getPromptTemplate(id);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    store.savePromptTemplate(updated);

    store.addAuditLog({
      jobId: 'N/A',
      tenantId: existing.tenantId,
      action: 'PROMPT_TEMPLATE_UPDATED',
      details: { template: updated },
    });

    return NextResponse.json({ template: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = store.getPromptTemplate(id);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    store.deletePromptTemplate(id);

    store.addAuditLog({
      jobId: 'N/A',
      tenantId: existing.tenantId,
      action: 'PROMPT_TEMPLATE_DELETED',
      details: { templateId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}