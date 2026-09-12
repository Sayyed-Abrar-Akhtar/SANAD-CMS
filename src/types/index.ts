import { z } from 'zod';

export type TenantStatus = 'active' | 'setup_incomplete';

export interface Tenant {
  id: string;
  name: string;
  jules_source_name: string; // e.g. "sources/github-acmeco-storefront"
  github_owner: string;
  github_repo: string;
  default_branch: string;
  status: TenantStatus;
  monthly_limit: number;
  used_count: number;
  createdAt: string;
  updatedAt: string;
}

export type InputFormat = 'text' | 'csv' | 'json';

export type InternalJobState =
  | 'queued'
  | 'interpreting'
  | 'generating_code'
  | 'needs_input'
  | 'pending_review'
  | 'rejected'
  | 'merged_pending_deploy'
  | 'done'
  | 'failed';

export type CustomerStatus =
  | 'Working…'
  | 'Working… (+ internal alert)'
  | 'Not approved'
  | 'Done ✅'
  | 'Couldn\'t complete — try rephrasing';

export const BlueprintTargetSchema = z.object({
  page: z.string(),
  component: z.string(),
  property: z.string(),
  value: z.any(),
});

export const BlueprintSchema = z.object({
  targets: z.array(BlueprintTargetSchema),
  summary: z.string(),
  riskFlags: z.array(z.string()),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export interface PullRequestInfo {
  url: string;
  number: number;
  branch: string;
}

export interface DeploymentInfo {
  id?: string;
  url?: string;
  status: 'pending' | 'succeeded' | 'error' | string;
}

export interface Job {
  jobId: string;
  tenantId: string;
  userId: string;
  format: InputFormat;
  rawInput: string;
  idempotencyKey?: string;
  internalState: InternalJobState;
  blueprint?: Blueprint;
  julesSessionId?: string;
  julesState?: string;
  pullRequest?: PullRequestInfo;
  deployment?: DeploymentInfo;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  jobId: string;
  tenantId: string;
  action: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Maps InternalJobState -> Customer Status per Specification Section 8
 */
export function getCustomerStatus(
  state: InternalJobState,
  julesState?: string
): CustomerStatus {
  switch (state) {
    case 'queued':
    case 'interpreting':
    case 'generating_code':
      return 'Working…';
    case 'needs_input':
      return 'Working… (+ internal alert)';
    case 'pending_review':
      return 'Working…';
    case 'rejected':
      return 'Not approved';
    case 'merged_pending_deploy':
      return 'Working…';
    case 'done':
      return 'Done ✅';
    case 'failed':
      return 'Couldn\'t complete — try rephrasing';
    default:
      return 'Working…';
  }
}
