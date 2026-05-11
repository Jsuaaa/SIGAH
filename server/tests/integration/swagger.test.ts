/**
 * Integration tests for Swagger/OpenAPI documentation endpoints.
 *
 * Does NOT require a database connection — only tests Express routes.
 * Skips the ../setup.ts (which calls pool.query) by not importing it.
 */

import request from 'supertest';
import app from '../../src/app';

describe('GET /api/docs.json', () => {
  it('responds 200 with JSON containing valid OpenAPI spec', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.openapi).toMatch(/^3\.0\./);
    expect(res.body.info.title).toBe('SIGAH API');
    expect(res.body.paths).toBeDefined();
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
  });
});

describe('GET /api/docs', () => {
  it('responds 200 or redirect to Swagger UI', async () => {
    // Swagger UI mounts at /api/docs — Express redirects the bare path to
    // /api/docs/ (301) and that final URL serves the HTML.
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    // Swagger UI always serves HTML
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });
});
