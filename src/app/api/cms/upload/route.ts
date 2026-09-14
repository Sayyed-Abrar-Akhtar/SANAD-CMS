import { NextRequest, NextResponse } from 'next/server';
import PapaParse from 'papaparse';
import { validateAndParseInput } from '@/lib/intake';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tenantId = formData.get('tenantId') as string || 'tenant-demo';
    const format = formData.get('format') as string;
    const idempotencyKey = formData.get('idempotencyKey') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|csv|json|docx)$/i)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: .txt, .csv, .json, .docx' },
        { status: 400 }
      );
    }

    let textContent: string;

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')) {
      // Extract text from .docx
      try {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value;
      } catch (err: any) {
        return NextResponse.json(
          { error: `Failed to parse .docx file: ${err.message}` },
          { status: 400 }
        );
      }
    } else {
      // Read as text
      textContent = await file.text();
    }

    // Use existing validation logic
    const contentType = file.type || (format ? (format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain') : 'text/plain');
    const parseResult = validateAndParseInput(textContent, contentType, format || undefined);

    if (!parseResult.valid) {
      return NextResponse.json(
        {
          error: 'Invalid file content or schema error',
          errors: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // Return parsed data so frontend can pre-fill form or submit directly
    return NextResponse.json({
      success: true,
      format: parseResult.format,
      data: parseResult.data,
      rawText: textContent,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}