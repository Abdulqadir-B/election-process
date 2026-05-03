/**
 * @jest-environment node
 */
/**
 * Unit tests for the maps-embed API route (/api/maps-embed)
 *
 * Validates input guards, missing API key handling, and correct HTML generation.
 */

import { GET } from '@/app/api/maps-embed/route';

// Silence console output in tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

function buildRequest(queryParam: string): Request {
  return new Request(`http://localhost/api/maps-embed?q=${encodeURIComponent(queryParam)}`);
}

describe('GET /api/maps-embed – Input Guards', () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeAll(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
  });

  afterAll(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  test('returns error HTML when location query param is empty', async () => {
    const req = new Request('http://localhost/api/maps-embed?q=');
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain('Invalid location');
  });

  test('returns error HTML when location is longer than 200 characters', async () => {
    const req = buildRequest('a'.repeat(201));
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain('Invalid location');
  });

  test('returns error HTML when GOOGLE_MAPS_API_KEY is missing', async () => {
    const savedKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const req = buildRequest('Delhi');
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain('Map not configured');

    process.env.GOOGLE_MAPS_API_KEY = savedKey;
  });
});

describe('GET /api/maps-embed – Successful Response', () => {
  beforeAll(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
  });

  test('returns an HTML document for a valid location', async () => {
    const req = buildRequest('Maharashtra');
    const res = await GET(req);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('<!DOCTYPE html>');
  });

  test('embeds the correct Maps URL with the location', async () => {
    const req = buildRequest('Karnataka');
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain('www.google.com/maps/embed');
    expect(text).toContain('Karnataka');
  });

  test('appends ", India" to the location in the embed URL', async () => {
    const req = buildRequest('Rajasthan');
    const res = await GET(req);
    const text = await res.text();
    // The encoded form of "Rajasthan, India" should appear in the HTML
    expect(text).toContain('Rajasthan%2C%20India');
  });

  test('uses the API key in the Maps embed URL', async () => {
    const req = buildRequest('Goa');
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain('test-maps-key');
  });

  test('sets X-Frame-Options to SAMEORIGIN', async () => {
    const req = buildRequest('Punjab');
    const res = await GET(req);
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  test('does not include raw double quotes in the iframe title attribute', async () => {
    // Prevent XSS via location parameter injecting quotes
    const req = buildRequest('Some "Quoted" Place');
    const res = await GET(req);
    const text = await res.text();
    // The title attr should not break out due to unescaped quotes
    expect(text).not.toContain('title="Polling Area Map for Some "Quoted" Place"');
  });
});
