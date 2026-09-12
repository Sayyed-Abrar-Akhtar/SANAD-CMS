import { Blueprint, Tenant, PullRequestInfo } from '@/types';

const JULES_API_URL = 'https://jules.googleapis.com/v1alpha';

export interface CreateJulesSessionParams {
  jobId: string;
  tenant: Tenant;
  blueprint: Blueprint;
  requirePlanApproval?: boolean;
}

export interface JulesSessionResponse {
  name: string; // e.g. "sessions/12345"
  state: 'QUEUED' | 'PLANNING' | 'IN_PROGRESS' | 'AWAITING_USER_FEEDBACK' | 'AWAITING_PLAN_APPROVAL' | 'COMPLETED' | 'FAILED' | string;
  title?: string;
  outputs?: Array<{
    pullRequest?: {
      url: string;
      number?: number;
      branch?: string;
    };
  }>;
  [key: string]: any;
}

export async function createJulesSession({
  jobId,
  tenant,
  blueprint,
  requirePlanApproval = false,
}: CreateJulesSessionParams): Promise<JulesSessionResponse> {
  const julesApiKey = process.env.JULES_API_KEY || 'mock-jules-api-key';

  const promptText = `Role: Senior Staff Next.js & React Engineer working inside an existing production codebase.
Task: Implement exactly the changes below — nothing else:
${JSON.stringify(blueprint, null, 2)}
Rules:
1. Only touch what's described above. Don't refactor unrelated code, upgrade dependencies, or edit files outside this scope.
2. Follow this repo's existing Next.js App Router conventions, TypeScript, and Tailwind config as they already stand — don't introduce new tooling.
3. Run the project's build and test suite before finishing. A change with a failing build is not done.
4. If anything here is ambiguous, or would require touching auth, billing, env config, or infra, stop and ask instead of guessing.`;

  const payload: Record<string, any> = {
    prompt: promptText,
    title: `CMS change — job ${jobId}`,
    sourceContext: {
      source: tenant.jules_source_name,
      githubRepoContext: { startingBranch: tenant.default_branch },
    },
    automationMode: 'AUTO_CREATE_PR',
  };

  if (requirePlanApproval) {
    payload.requirePlanApproval = true;
  }

  // Simulation mode during tests / mock key
  if (process.env.NODE_ENV === 'test' || julesApiKey === 'mock-jules-api-key') {
    return {
      name: `sessions/mock-session-${jobId}`,
      state: 'QUEUED',
      title: payload.title,
    };
  }

  const res = await fetch(`${JULES_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': julesApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Jules API create session failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function getJulesSession(sessionId: string): Promise<JulesSessionResponse> {
  const julesApiKey = process.env.JULES_API_KEY || 'mock-jules-api-key';

  if (process.env.NODE_ENV === 'test' || julesApiKey === 'mock-jules-api-key') {
    return {
      name: sessionId,
      state: 'COMPLETED',
      outputs: [
        {
          pullRequest: {
            url: 'https://github.com/acmeco/storefront/pull/42',
            number: 42,
            branch: 'jules/cms-patch-42',
          },
        },
      ],
    };
  }

  const res = await fetch(`${JULES_API_URL}/${sessionId}`, {
    headers: {
      'x-goog-api-key': julesApiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Jules session ${sessionId}: ${res.statusText}`);
  }

  return await res.json();
}

export async function sendJulesFeedback(
  sessionId: string,
  message: string
): Promise<void> {
  const julesApiKey = process.env.JULES_API_KEY || 'mock-jules-api-key';

  if (process.env.NODE_ENV === 'test' || julesApiKey === 'mock-jules-api-key') {
    return;
  }

  await fetch(`${JULES_API_URL}/${sessionId}:sendMessage`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': julesApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
}

export function extractPRFromSession(session: JulesSessionResponse): PullRequestInfo | undefined {
  if (!session.outputs || session.outputs.length === 0) return undefined;
  for (const out of session.outputs) {
    if (out.pullRequest && out.pullRequest.url) {
      let pullNumber = out.pullRequest.number;
      if (!pullNumber) {
        const match = out.pullRequest.url.match(/\/pull\/(\d+)/);
        if (match) pullNumber = parseInt(match[1], 10);
      }
      return {
        url: out.pullRequest.url,
        number: pullNumber || 0,
        branch: out.pullRequest.branch || 'jules-branch',
      };
    }
  }
  return undefined;
}
