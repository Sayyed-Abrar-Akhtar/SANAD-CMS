import { describe, it, expect, beforeEach } from 'vitest';
import { validateAndParseInput } from '@/lib/intake';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';
import { POST as requestsPost } from '@/app/api/cms/requests/route';

describe('Intake Module and API Endpoint', () => {
  beforeEach(() => {
    store.reset();
    store.saveTenant({
      id: 'tenant-demo',
      name: 'Acme',
      jules_source_name: 'sources/github-acme',
      github_owner: 'acme',
      github_repo: 'web',
      default_branch: 'main',
      status: 'active',
      monthly_limit: 5,
      used_count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe('validateAndParseInput', () => {
    it('should validate plain text input', () => {
      const res = validateAndParseInput('Change title to Hello World', 'text/plain');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('text');
      expect(res.data).toBe('Change title to Hello World');
    });

    it('should validate valid CSV input', () => {
      const csvContent = `page,component,property,newValue,note\n/about,Hero,title,New Hero Title,Update banner`;
      const res = validateAndParseInput(csvContent, 'text/csv');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('csv');
      expect(res.data).toHaveLength(1);
      expect(res.data[0].newValue).toBe('New Hero Title');
    });

    it('should reject invalid CSV input missing required columns', () => {
      const badCsv = `page,component\n/about,Hero`;
      const res = validateAndParseInput(badCsv, 'text/csv');
      expect(res.valid).toBe(false);
      expect(res.errors?.length).toBeGreaterThan(0);
    });

    it('should validate valid JSON input', () => {
      const jsonContent = JSON.stringify({
        targets: [{ page: '/contact', component: 'Form', property: 'buttonText', value: 'Send' }],
        summary: 'Update button',
        riskFlags: [],
      });
      const res = validateAndParseInput(jsonContent, 'application/json');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('json');
      expect(res.data.summary).toBe('Update button');
    });
  });

  describe('POST /api/cms/requests Route Handler', () => {
    it('should accept text input and respond with 202 and jobId', async () => {
      const req = new NextRequest('http://localhost:3000/api/cms/requests', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-tenant-id': 'tenant-demo',
        },
        body: 'Update footer copyright to 2026',
      });

      const res = await requestsPost(req);
      expect(res.status).toBe(202);

      const body = await res.json();
      expect(body.jobId).toBeDefined();
      expect(body.status).toBe('queued');

      // Verify stored in DB
      const storedJob = store.getJob(body.jobId);
      expect(storedJob?.rawInput).toBe('Update footer copyright to 2026');
    });

    it('should return existing job on idempotency key match', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/cms/requests', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-tenant-id': 'tenant-demo',
          'x-idempotency-key': 'key-123',
        },
        body: 'Change header logo',
      });

      const res1 = await requestsPost(req1);
      const body1 = await res1.json();

      const req2 = new NextRequest('http://localhost:3000/api/cms/requests', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-tenant-id': 'tenant-demo',
          'x-idempotency-key': 'key-123',
        },
        body: 'Change header logo',
      });

      const res2 = await requestsPost(req2);
      const body2 = await res2.json();

      expect(body2.jobId).toBe(body1.jobId);
      expect(body2.message).toContain('Duplicate request detected');
    });
  });
});
