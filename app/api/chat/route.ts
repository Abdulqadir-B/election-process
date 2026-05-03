import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Initialized once at module level — efficient, avoids re-creating on every request
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Rate Limiter ────────────────────────────────────────────────────────────
// Simple in-memory store: tracks { count, windowStart } per IP address.
// Allows MAX_REQUESTS per WINDOW_MS per unique IP. No extra packages needed.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10;                 // max 10 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New IP or window has expired — reset counter
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_REQUESTS) {
    return true; // Limit exceeded within current window
  }

  entry.count++;
  return false;
}

// Periodically clean up stale entries to prevent memory leaks
// Runs every 5 minutes, removes entries whose window has long expired
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();
// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Guard: API key must be present
  if (!process.env.GEMINI_API_KEY) {
    logger.error({ message: "GEMINI_API_KEY is missing from environment variables.", route: "/api/chat" });
    return NextResponse.json({ error: "The assistant is currently unavailable due to a configuration issue. Please try again later." }, { status: 500 });
  }

  // 2. Rate limiting — check before doing any heavy work
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    logger.warn({ message: "Rate limit exceeded", ip, route: "/api/chat" });
    return NextResponse.json(
      { error: "You're sending messages too quickly. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const { messages, language } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request: messages array is required." }, { status: 400 });
    }

    // ── Input Size & Content Validation ──────────────────────────────────────
    // Guard 1: Prevent unbounded history (each message sends the full history to Gemini)
    if (messages.length > 50) {
      return NextResponse.json({ error: "Conversation is too long. Please refresh to start a new session." }, { status: 400 });
    }

    // Guard 2: Validate every message has a proper string content field
    for (const msg of messages) {
      if (typeof msg.content !== 'string') {
        return NextResponse.json({ error: "Invalid message format." }, { status: 400 });
      }
    }

    // Guard 3: Cap the latest user message to 1000 characters to prevent token abuse
    const rawLatestMessage = messages[messages.length - 1].content as string;
    if (rawLatestMessage.length > 1000) {
      return NextResponse.json({ error: "Your message is too long. Please keep it under 1000 characters." }, { status: 400 });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Language instruction appended to system prompt
    const langName = language || "English";
    const languageInstruction = langName === "English"
      ? ""
      : `\n\nLANGUAGE RULE: The user has selected ${langName} as their language. You MUST respond conversationally in ${langName}. However, the JSON block at the end must always be valid JSON with English keys — only the VALUES inside the JSON may be in ${langName}.`;

    // 2. Convert frontend messages to Gemini chat history format
    // History = all messages EXCEPT the latest one
    let history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Gemini API requires chat history to START with a 'user' message
    // Strip any leading 'model' messages (e.g. the initial welcome message)
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    const latestMessage = rawLatestMessage.trim();

    // 3. Define fallback models in order of preference (highest free-tier quota first)
    // gemini-2.0-flash: 1500 RPD free | gemini-2.0-flash-lite: 1500 RPD free | gemini-2.5-flash: 20 RPD free
    const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"];
    const systemInstruction = `You are a professional, authoritative, and helpful Civic Assistant for India's official election information website, powered by the Election Commission of India (ECI).
Your goal is to help Indian citizens find accurate election information for their state or city.

IMPORTANT RULES:
1. You cover ALL Indian states (e.g. Uttar Pradesh, Maharashtra, Tamil Nadu, Karnataka, West Bengal, Rajasthan, Bihar, Gujarat, etc.), Union Territories (Delhi, J&K, Puducherry, etc.), and major cities.
2. If the user has not told you their Indian state or city, politely ask which state or city they are from.
3. Once the user provides their state or city, provide the following information specific to that location:
   - POLLING BOOTH: Explain that polling booths are assigned by the ECI based on the voter's registered address. Citizens can find their booth at https://voters.eci.gov.in or by calling Voter Helpline 1950.
   - KEY DEADLINES: Mention the voter registration/name correction deadline for their state (typically 30 days before election date). Refer them to https://voters.eci.gov.in for live deadlines.
   - ID REQUIREMENTS: In India, the primary ID is the EPIC card (Electoral Photo Identity Card / Voter ID). If unavailable, the ECI accepts 12 alternative documents: Aadhaar card, Passport, Driving Licence, PAN card, MNREGS Job Card, Smart card issued by RGI, Passbook with photo (bank/post office), Health Insurance Smart card (Labour Ministry), Pension document with photo, NPR Smart Card, Official identity card issued by MP/MLA/MLC, and any valid Govt-issued photo ID.
4. Also mention the type of upcoming election if known: Lok Sabha (general/national), Vidhan Sabha (state assembly), or local body (Panchayat/Municipal Corporation).
5. CRITICAL: Once you have the user's location and have provided the information, you MUST append a JSON block at the very end of your response. The JSON block must be formatted exactly like this:
\`\`\`json
{
  "type": "dashboard_update",
  "stateName": "Name of the state or city the user mentioned",
  "pollingLocation": "Brief summary of how to find polling booth in [State/City]...",
  "deadlines": "Brief summary of voter registration deadlines for [State/City]...",
  "idRequirements": "EPIC card (Voter ID) is primary. Alternates accepted: Aadhaar card, Passport, Driving Licence, PAN card, MNREGS Job Card, Smart card (RGI), Passbook with photo, Health Insurance Smart card, Pension document with photo, NPR Smart Card, MP/MLA/MLC identity card, valid Govt-issued photo ID",
  "timeline": [
    { "date": "YYYY-MM-DD", "event": "Voter Registration Deadline" },
    { "date": "YYYY-MM-DD", "event": "Last Date for Name Correction" },
    { "date": "YYYY-MM-DD", "event": "Election Day" },
    { "date": "YYYY-MM-DD", "event": "Result Declaration" }
  ]
}
\`\`\`
Use real or best-estimate dates for the timeline based on the state's known election schedule. If exact dates are unknown, provide approximate dates based on typical ECI election schedules.
Keep your conversational response brief, professional, and clear. Rely on the JSON block to display the structured data. Always mention Voter Helpline 1950 and https://voters.eci.gov.in as key resources.${languageInstruction}`;

    let responseText = "";
    let lastError = null;

    // 4. Start chat session with history and send the latest message using a fallback loop
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
        });

        const chat = model.startChat({ history });

        // Race the model response against a 15-second timeout.
        // If the model hangs (no error, no response), the timeout wins
        // and the catch block moves us to the next fallback model.
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${modelName} timed out after 15s`)), 15000)
        );
        const result = await Promise.race([chat.sendMessage(latestMessage), timeoutPromise]);
        responseText = result.response.text();

        logger.info({ message: "Gemini model responded successfully", model: modelName, ip, language: langName });

        // Success! Clear error and break out of the fallback loop
        lastError = null;
        break;
      } catch (err: any) {
        logger.warn({ message: `Model ${modelName} failed, trying next fallback`, errorMessage: err?.message || String(err), model: modelName });
        lastError = err;
        // Continue to the next model in the array
      }
    }

    if (lastError) {
      // If all models in the fallback array failed, throw the last error
      throw lastError;
    }

    return NextResponse.json({ message: responseText });

  } catch (error: any) {
    // 5. Log the real error with Cloud Logging, return a friendly message to UI
    const errorMessage = error?.message || "Unknown error occurred.";
    logger.error({ message: "Gemini Chat API unhandled error", errorMessage, route: "/api/chat", ip });
    return NextResponse.json(
      { error: "I am currently experiencing high traffic and cannot fetch the details right now. Please try again in a few moments." },
      { status: 500 }
    );
  }
}
