/**
 * @jest-environment node
 */
/**
 * Integration tests — end-to-end validation of request/response shapes
 * shared across the election assistant API surface.
 *
 * Tests JSON contract conformance and cross-cutting concerns like
 * Content-Type headers and error payload shape.
 */

import { NextRequest } from 'next/server';

// ── Mock Gemini ──────────────────────────────────────────────────────────────
jest.mock('@google/generative-ai', () => {
  const mockSendMessage = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({ sendMessage: mockSendMessage }),
      }),
    })),
    mockSendMessage,
  };
});

const { mockSendMessage } = require('@google/generative-ai');

process.env.GEMINI_API_KEY = 'integration-test-key';
process.env.GOOGLE_MAPS_API_KEY = 'integration-maps-key';

import { POST } from '@/app/api/chat/route';
import { GET } from '@/app/api/maps-embed/route';
// ─────────────────────────────────────────────────────────────────────────────

describe('API Response Contract', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValue({
      response: { text: () => 'Hello from Gemini' },
    });
  });

  test('chat success response has { message } key', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '20.0.0.1',
      },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json).toHaveProperty('message');
    expect(typeof json.message).toBe('string');
  });

  test('chat error response has { error } key with a string value', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '20.0.0.2' },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  test('maps-embed success response Content-Type is text/html', async () => {
    const req = new Request('http://localhost/api/maps-embed?q=Delhi');
    const res = await GET(req);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  test('chat response Content-Type is application/json', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Test' }] }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '20.0.0.3' },
    });
    const res = await POST(req);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });
});

describe('Chat – Gemini Response Parsing', () => {
  test('returns the full text from Gemini model in the message field', async () => {
    const sampleResponse = `
Here is the info for Delhi.

\`\`\`json
{
  "type": "dashboard_update",
  "stateName": "Delhi",
  "pollingLocation": "Find booth at voters.eci.gov.in",
  "deadlines": "30 days before election",
  "idRequirements": "EPIC card or Aadhaar",
  "timeline": []
}
\`\`\`
    `.trim();

    mockSendMessage.mockResolvedValue({
      response: { text: () => sampleResponse },
    });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Delhi voting info' }] }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '20.0.1.1' },
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.message).toContain('dashboard_update');
    expect(json.message).toContain('Delhi');
  });
});
