import { Blueprint, BlueprintSchema, Tenant } from '@/types';
import { store } from '@/lib/store';

// Prompt injection patterns
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+a/i,
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
  /javascript:/i,
  /DROP\s+TABLE/i,
];

// Out of scope forbidden target paths/topics (auth, billing, env, infra)
const FORBIDDEN_SCOPE_PATTERNS = [
  /auth(entication)?/i,
  /login/i,
  /password/i,
  /secret/i,
  /billing/i,
  /stripe/i,
  /payment/i,
  /credit\s*card/i,
  /\.env/i,
  /environment\s*variable/i,
  /docker/i,
  /kubernetes/i,
  /terraforms/i,
  /aws/i,
  /infra(structure)?/i,
  /database\s*connection/i,
];

export interface RefinementResult {
  allowed: boolean;
  rejectReason?: string;
  blueprint?: Blueprint;
}

/**
 * Sanitizes input text by scrubbing hazardous characters and HTML tags.
 */
export function sanitizeInputText(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Checks for prompt injection vectors.
 */
export function detectPromptInjection(input: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Checks whether request touches forbidden out-of-scope boundaries.
 */
export function isOutOfScope(input: string, blueprint?: Blueprint): boolean {
  // Check raw string text
  if (FORBIDDEN_SCOPE_PATTERNS.some((pattern) => pattern.test(input))) {
    return true;
  }

  // Check structured blueprint fields if present
  if (blueprint) {
    for (const target of blueprint.targets) {
      const combined = `${target.page} ${target.component} ${target.property} ${String(
        target.value
      )}`;
      if (FORBIDDEN_SCOPE_PATTERNS.some((p) => p.test(combined))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks tenant usage quota limits.
 */
export function checkTenantUsageLimit(tenant: Tenant): {
  allowed: boolean;
  reason?: string;
} {
  if (tenant.used_count >= tenant.monthly_limit) {
    return {
      allowed: false,
      reason: `Tenant monthly limit reached (${tenant.used_count}/${tenant.monthly_limit}).`,
    };
  }
  return { allowed: true };
}

/**
 * Increments tenant usage counter upon session generation.
 */
export function incrementTenantUsage(tenantId: string): void {
  const tenant = store.getTenant(tenantId);
  if (tenant) {
    tenant.used_count += 1;
    store.saveTenant(tenant);
  }
}

/**
 * Refines raw input into a structured Blueprint (PROMPT_JSON_MAP).
 * Calls LLM or deterministic fallback parser/refiner.
 */
export async function refineInputToBlueprint(
  rawInput: string,
  format: 'text' | 'csv' | 'json',
  tenant: Tenant
): Promise<RefinementResult> {
  // 1. Check Usage Limits
  const limitCheck = checkTenantUsageLimit(tenant);
  if (!limitCheck.allowed) {
    return { allowed: false, rejectReason: limitCheck.reason };
  }

  // 2. Sanitize and Check Prompt Injection
  const sanitized = sanitizeInputText(rawInput);
  if (detectPromptInjection(sanitized) || detectPromptInjection(rawInput)) {
    return {
      allowed: false,
      rejectReason: 'Request rejected due to suspected prompt injection or unsafe content.',
    };
  }

  // 3. Out-of-Scope Pre-check
  if (isOutOfScope(sanitized)) {
    return {
      allowed: false,
      rejectReason:
        'Request rejected: modification of auth, billing, environment variables, or infrastructure is out of scope.',
    };
  }

  // 4. Transform format into Blueprint schema
  let blueprint: Blueprint;

  if (format === 'json') {
    try {
      const jsonParsed = JSON.parse(sanitized);
      const val = BlueprintSchema.safeParse(jsonParsed);
      if (val.success) {
        blueprint = val.data;
      } else {
        // Normalize close JSON into Blueprint schema
        blueprint = {
          targets: Array.isArray(jsonParsed.targets)
            ? jsonParsed.targets.map((t: any) => ({
                page: String(t.page || 'global'),
                component: String(t.component || 'General'),
                property: String(t.property || 'content'),
                value: t.value ?? t.newValue ?? '',
              }))
            : [
                {
                  page: String(jsonParsed.page || 'global'),
                  component: String(jsonParsed.component || 'General'),
                  property: String(jsonParsed.property || 'content'),
                  value: jsonParsed.value ?? jsonParsed.newValue ?? '',
                },
              ],
          summary: jsonParsed.summary || 'Normalized JSON CMS request',
          riskFlags: jsonParsed.riskFlags || [],
        };
      }
    } catch {
      return { allowed: false, rejectReason: 'Invalid JSON payload structure' };
    }
  } else if (format === 'csv') {
    // Convert parsed CSV rows into blueprint targets
    const lines = sanitized.split('\n').filter((l) => l.trim().length > 0);
    // Parse header and rows
    const targets: Blueprint['targets'] = [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const pageIdx = headers.indexOf('page');
    const compIdx = headers.indexOf('component');
    const propIdx = headers.indexOf('property');
    const valIdx = headers.indexOf('newvalue') !== -1 ? headers.indexOf('newvalue') : headers.indexOf('value');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length >= 3) {
        targets.push({
          page: cols[pageIdx !== -1 ? pageIdx : 0] || 'global',
          component: cols[compIdx !== -1 ? compIdx : 1] || 'General',
          property: cols[propIdx !== -1 ? propIdx : 2] || 'content',
          value: cols[valIdx !== -1 ? valIdx : 3] || '',
        });
      }
    }

    if (targets.length === 0) {
      // Fallback
      targets.push({
        page: 'global',
        component: 'General',
        property: 'content',
        value: sanitized,
      });
    }

    blueprint = {
      targets,
      summary: `Batch CSV CMS update with ${targets.length} target edit(s)`,
      riskFlags: [],
    };
  } else {
    // Format is 'text' - perform LLM refinement or structured conversion
    // If OPENAI_API_KEY / ANTHROPIC_API_KEY is configured in env, call LLM; otherwise deterministic refinement
    if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        blueprint = await callLlmRefinementLayer(sanitized);
      } catch (err) {
        // Fallback to deterministic extraction on LLM error
        blueprint = deterministicTextRefine(sanitized);
      }
    } else {
      blueprint = deterministicTextRefine(sanitized);
    }
  }

  // Final Blueprint validation against schema
  const finalVal = BlueprintSchema.safeParse(blueprint);
  if (!finalVal.success) {
    return {
      allowed: false,
      rejectReason: `Blueprint schema validation failed: ${finalVal.error.message}`,
    };
  }

  // 5. Check Blueprint targets for Out of Scope violations
  if (isOutOfScope(sanitized, finalVal.data)) {
    return {
      allowed: false,
      rejectReason:
        'Request rejected: Blueprint target modifies forbidden auth, billing, env, or infra files.',
    };
  }

  return { allowed: true, blueprint: finalVal.data };
}

function deterministicTextRefine(text: string): Blueprint {
  return {
    targets: [
      {
        page: 'global',
        component: 'ContentBlock',
        property: 'text',
        value: text,
      },
    ],
    summary: `Text CMS update request: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
    riskFlags: [],
  };
}

async function callLlmRefinementLayer(text: string): Promise<Blueprint> {
  // If OpenAI API key is present
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a CMS Refinement agent. Convert the user request into JSON adhering strictly to: { "targets": [{ "page": string, "component": string, "property": string, "value": any }], "summary": string, "riskFlags": string[] }',
          },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  return deterministicTextRefine(text);
}
