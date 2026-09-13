import PapaParse from 'papaparse';
import { z } from 'zod';
import { BlueprintSchema, Blueprint } from '@/types';

export const CsvRowSchema = z.object({
  page: z.string().min(1, 'page is required'),
  component: z.string().min(1, 'component is required'),
  property: z.string().min(1, 'property is required'),
  newValue: z.string().min(1, 'newValue is required'),
  note: z.string().optional(),
});

export interface ParseResult {
  valid: boolean;
  format: 'text' | 'csv' | 'json';
  data?: any;
  errors?: string[];
}

/**
 * Validates request input per format before any LLM calls.
 */
export function validateAndParseInput(
  rawInput: string,
  contentTypeHeader?: string,
  formatParam?: string
): ParseResult {
  let format: 'text' | 'csv' | 'json' = 'text';

  if (contentTypeHeader) {
    if (contentTypeHeader.includes('text/csv')) {
      format = 'csv';
    } else if (contentTypeHeader.includes('application/json')) {
      format = 'json';
    } else if (contentTypeHeader.includes('text/plain')) {
      format = 'text';
    }
  }

  if (formatParam && ['text', 'csv', 'json'].includes(formatParam)) {
    format = formatParam as 'text' | 'csv' | 'json';
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, format, errors: ['Raw input content cannot be empty'] };
  }

  if (format === 'json') {
    try {
      const parsedJson = JSON.parse(trimmed);
      // Validate against blueprint schema if it claims to be JSON blueprint
      const blueprintValidation = BlueprintSchema.safeParse(parsedJson);
      if (blueprintValidation.success) {
        return { valid: true, format: 'json', data: blueprintValidation.data };
      }

      // If it's standard JSON but not fully blueprint schema, return JSON object for refinement
      return { valid: true, format: 'json', data: parsedJson };
    } catch (err: any) {
      return { valid: false, format: 'json', errors: [`Invalid JSON payload: ${err.message}`] };
    }
  }

  if (format === 'csv') {
    const parsedCsv = PapaParse.parse(trimmed, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsedCsv.errors && parsedCsv.errors.length > 0) {
      const errMsgs = parsedCsv.errors.map((e) => `CSV line ${e.row}: ${e.message}`);
      return { valid: false, format: 'csv', errors: errMsgs };
    }

    if (!parsedCsv.data || parsedCsv.data.length === 0) {
      return { valid: false, format: 'csv', errors: ['CSV file contains no rows'] };
    }

    const rowErrors: string[] = [];
    const validRows: any[] = [];

    parsedCsv.data.forEach((row: any, idx: number) => {
      const rowResult = CsvRowSchema.safeParse(row);
      if (!rowResult.success) {
        rowErrors.push(
          `Row ${idx + 1} invalid: ${rowResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', ')}`
        );
      } else {
        validRows.push(rowResult.data);
      }
    });

    if (rowErrors.length > 0) {
      return { valid: false, format: 'csv', errors: rowErrors };
    }

    return { valid: true, format: 'csv', data: validRows };
  }

  // Text format
  return { valid: true, format: 'text', data: trimmed };
}
