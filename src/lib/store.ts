import { Tenant, Job, AuditLog } from '@/types';

interface PromptTemplate {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  isQuickSubmit: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory persistent datastore for the orchestrator
class Store {
  private tenants: Map<string, Tenant> = new Map();
  private jobs: Map<string, Job> = new Map();
  private auditLogs: AuditLog[] = [];
  private idempotencyKeys: Map<string, string> = new Map(); // key -> jobId
  private repoLocks: Map<string, string> = new Map(); // repoKey ("owner/repo") -> currentJobId
  private promptTemplates: Map<string, PromptTemplate> = new Map();

  constructor() {
    // Seed default tenant for immediate testing / development
    const defaultTenant: Tenant = {
      id: 'tenant-demo',
      name: 'Acme Storefront Tenant',
      jules_source_name: 'sources/github-acmeco-storefront',
      github_owner: 'acmeco',
      github_repo: 'storefront',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tenants.set(defaultTenant.id, defaultTenant);
  }

  // Tenant methods
  getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  saveTenant(tenant: Tenant): Tenant {
    tenant.updatedAt = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  // Job methods
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  saveJob(job: Job): Job {
    job.updatedAt = new Date().toISOString();
    this.jobs.set(job.jobId, job);
    return job;
  }

  getJobByIdempotencyKey(key: string): Job | undefined {
    const jobId = this.idempotencyKeys.get(key);
    if (!jobId) return undefined;
    return this.getJob(jobId);
  }

  setIdempotencyKey(key: string, jobId: string): void {
    this.idempotencyKeys.set(key, jobId);
  }

  getJobsByTenant(tenantId: string): Job[] {
    return Array.from(this.jobs.values()).filter((j) => j.tenantId === tenantId);
  }

  // Audit Log methods
  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const fullLog: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(fullLog);
    return fullLog;
  }

  getAuditLogs(jobId?: string): AuditLog[] {
    if (jobId) {
      return this.auditLogs.filter((l) => l.jobId === jobId);
    }
    return this.auditLogs;
  }

  // Repo Locking methods
  acquireRepoLock(repoKey: string, jobId: string): boolean {
    const currentLockedJob = this.repoLocks.get(repoKey);
    if (currentLockedJob && currentLockedJob !== jobId) {
      return false;
    }
    this.repoLocks.set(repoKey, jobId);
    return true;
  }

  releaseRepoLock(repoKey: string, jobId: string): void {
    if (this.repoLocks.get(repoKey) === jobId) {
      this.repoLocks.delete(repoKey);
    }
  }

  isRepoLocked(repoKey: string): boolean {
    return this.repoLocks.has(repoKey);
  }

  // Prompt Template methods
  getPromptTemplate(id: string): PromptTemplate | undefined {
    return this.promptTemplates.get(id);
  }

  getPromptTemplatesByTenant(tenantId: string): PromptTemplate[] {
    return Array.from(this.promptTemplates.values()).filter((t) => t.tenantId === tenantId);
  }

  getAllPromptTemplates(): PromptTemplate[] {
    return Array.from(this.promptTemplates.values());
  }

  savePromptTemplate(template: PromptTemplate): PromptTemplate {
    template.updatedAt = new Date().toISOString();
    this.promptTemplates.set(template.id, template);
    return template;
  }

  deletePromptTemplate(id: string): void {
    this.promptTemplates.delete(id);
  }

  // Reset store for testing
  reset(): void {
    this.tenants.clear();
    this.jobs.clear();
    this.auditLogs = [];
    this.idempotencyKeys.clear();
    this.repoLocks.clear();
    this.promptTemplates.clear();
  }
}

// Global singleton instance
export const store = new Store();