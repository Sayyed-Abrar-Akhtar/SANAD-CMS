import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { checkGitHubRepoPermissions } from '@/lib/github';
import { Tenant } from '@/types';

const BindTenantSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  julesSourceName: z.string().regex(/^sources\/[a-zA-Z0-9_-]+$/, {
    message: 'julesSourceName must be in format "sources/<source-id>"',
  }),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
  defaultBranch: z.string().default('main'),
  monthlyLimit: z.number().int().positive().default(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BindTenantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      tenantId,
      name,
      julesSourceName,
      githubOwner,
      githubRepo,
      defaultBranch,
      monthlyLimit,
    } = parsed.data;

    // Health check step 4: confirm GitHub App has PR-creation rights on that repo
    const healthCheck = await checkGitHubRepoPermissions(githubOwner, githubRepo);

    const status = healthCheck.ok ? 'active' : 'setup_incomplete';

    const tenant: Tenant = {
      id: tenantId,
      name,
      jules_source_name: julesSourceName,
      github_owner: githubOwner,
      github_repo: githubRepo,
      default_branch: defaultBranch,
      status,
      monthly_limit: monthlyLimit,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveTenant(tenant);
    store.addAuditLog({
      jobId: 'N/A',
      tenantId,
      action: 'TENANT_BOUND',
      details: { tenant, healthCheck },
    });

    return NextResponse.json({
      tenant,
      healthCheck,
      message:
        status === 'active'
          ? 'Tenant bound and health check passed successfully.'
          : 'Tenant created, but health check failed; status set to setup_incomplete.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
