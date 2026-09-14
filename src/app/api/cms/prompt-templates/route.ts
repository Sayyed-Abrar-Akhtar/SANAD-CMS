import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { z } from 'zod';

const PromptTemplateSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  isQuickSubmit: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    const templates = tenantId
      ? store.getPromptTemplatesByTenant(tenantId)
      : store.getAllPromptTemplates();

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PromptTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, tenantId, title, body: templateBody, isQuickSubmit } = parsed.data;

    const templateId = id || `template-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const template = {
      id: templateId,
      tenantId,
      title,
      body: templateBody,
      isQuickSubmit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.savePromptTemplate(template);

    store.addAuditLog({
      jobId: 'N/A',
      tenantId,
      action: 'PROMPT_TEMPLATE_CREATED',
      details: { template },
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}