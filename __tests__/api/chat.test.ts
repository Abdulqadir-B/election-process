/**
 * @jest-environment node
 */
/**
 * Unit tests for chat API route (/api/chat)
 *
 * Tests input validation, rate limiting responses, and response structure
 * without making real calls to the Gemini API.
 */

import { NextRequest } from 'next/server';

// ── Mock the Gemini SDK before importing the route ──────────────────────────
jest.mock('@google/generative-ai', () => {
  const mockSendMessage = jest.fn();
  const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
  const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
    mockSendMessage,
    mockStartChat,
  };
});

const { mockSendMessage, mockStartChat } = require('@google/generative-ai');
// ───────────────────────────────────────────────────────────────────────────

// Set required env vars before importing the route module
process.env.GEMINI_API_KEY = 'test-api-key-12345';

import { POST } from '@/app/api/chat/route';

// Helper to build a NextRequest-compatible mock
function buildRequest(body: unknown, ip = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  });
}

describe('POST /api/chat – Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      response: { text: () => 'Mock Gemini response' },
    });
  });

  test('returns 400 when messages array is missing', async () => {
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/messages array is required/i);
  });

  test('returns 400 when messages is an empty array', async () => {
    const req = buildRequest({ messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/messages array is required/i);
  });

  test('returns 400 when messages array exceeds 50 items', async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: 'user',
      content: `message ${i}`,
    }));
    const req = buildRequest({ messages });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
  });

  test('returns 400 when a message has non-string content', async () => {
    const req = buildRequest({
      messages: [{ role: 'user', content: 12345 }],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid message format/i);
  });

  test('returns 400 when latest message exceeds 1000 characters', async () => {
    const req = buildRequest({
      messages: [{ role: 'user', content: 'a'.repeat(1001) }],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
  });

  test('returns 200 with Gemini response for a valid request', async () => {
    const req = buildRequest({
      messages: [{ role: 'user', content: 'Which state am I in?' }],
      language: 'English',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Mock Gemini response');
  });

  test('returns 200 when language is omitted (defaults to English)', async () => {
    const req = buildRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test('calls Gemini with exactly the latest message text', async () => {
    const req = buildRequest({
      messages: [{ role: 'user', content: 'Tell me about voting in Delhi' }],
    });
    await POST(req);
    expect(mockSendMessage).toHaveBeenCalledWith('Tell me about voting in Delhi');
  });

  test('strips leading model messages from history', async () => {
    const req = buildRequest({
      messages: [
        { role: 'assistant', content: 'Welcome! How can I help?' }, // model first — should be stripped
        { role: 'user', content: 'I am from Maharashtra' },
        { role: 'assistant', content: 'Great! Here is info for Maharashtra.' },
        { role: 'user', content: 'What are the deadlines?' },
      ],
    });
    await POST(req);
    // The history passed to startChat should not start with a model message
    const historyArg = mockStartChat.mock.calls[0][0].history;
    expect(historyArg[0].role).toBe('user');
  });

  test('returns 500 when all Gemini models fail', async () => {
    mockSendMessage.mockRejectedValue(new Error('API error'));
    const req = buildRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    }, '10.0.0.99'); // Different IP to avoid rate limit interference
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe('POST /api/chat – API Key Guard', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  test('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = buildRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    }, '10.0.1.1');
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    process.env.GEMINI_API_KEY = 'test-api-key-12345'; // restore
  });
});
