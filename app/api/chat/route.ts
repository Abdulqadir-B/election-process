import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialized once at module level — efficient, avoids re-creating on every request
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  // 1. Guard: API key must be present
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing from environment variables.");
    return NextResponse.json({ error: "Server misconfiguration: GEMINI_API_KEY is not set." }, { status: 500 });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request: messages array is required." }, { status: 400 });
    }

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

    const latestMessage = messages[messages.length - 1].content;

    // 3. Get the model — gemini-2.5-flash requires SDK >= 0.21.0
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are a professional, authoritative, and helpful Civic Assistant for India's official election information website, powered by the Election Commission of India (ECI).
Your goal is to help Indian citizens find accurate election information for their state or city.

IMPORTANT RULES:
1. You cover ALL Indian states (e.g. Uttar Pradesh, Maharashtra, Tamil Nadu, Karnataka, West Bengal, Rajasthan, Bihar, Gujarat, etc.), Union Territories (Delhi, J&K, Puducherry, etc.), and major cities.
2. If the user has not told you their Indian state or city, politely ask: "Which Indian state or city are you from?"
3. Once the user provides their state or city, provide the following information specific to that location:
   - POLLING BOOTH: Explain that polling booths are assigned by the ECI based on the voter's registered address. Citizens can find their booth at https://voters.eci.gov.in or by calling Voter Helpline 1950.
   - KEY DEADLINES: Mention the voter registration/name correction deadline for their state (typically 30 days before election date). Refer them to https://voters.eci.gov.in (National Voters' Service Portal) for live deadlines.
   - ID REQUIREMENTS: In India, the primary ID is the EPIC card (Electoral Photo Identity Card / Voter ID). If unavailable, the ECI accepts 12 alternative documents: Aadhaar card, Passport, Driving Licence, PAN card, MNREGS Job Card, Smart card issued by RGI, Passbook with photo (bank/post office), Health Insurance Smart card (Labour Ministry), Pension document with photo, NPR Smart Card, Official identity card issued by MP/MLA/MLC, and any valid Govt-issued photo ID.
4. Also mention the type of upcoming election if known: Lok Sabha (general/national), Vidhan Sabha (state assembly), or local body (Panchayat/Municipal Corporation).
5. CRITICAL: Once you have the user's location and have provided the information, you MUST append a JSON block at the very end of your response. The JSON block must be formatted exactly like this:
\`\`\`json
{
  "type": "dashboard_update",
  "pollingLocation": "Brief summary of how to find polling booth in [State/City]...",
  "deadlines": "Brief summary of voter registration deadlines for [State/City]...",
  "idRequirements": "EPIC card (Voter ID) is primary. Alternates accepted: Aadhaar card, Passport, Driving Licence, PAN card, MNREGS Job Card, Smart card (RGI), Passbook with photo, Health Insurance Smart card, Pension document with photo, NPR Smart Card, MP/MLA/MLC identity card, valid Govt-issued photo ID"
}
\`\`\`
Keep your conversational response brief, professional, and in simple English. Rely on the JSON block to display the heavy data. Always mention Voter Helpline 1950 and https://voters.eci.gov.in as key resources.`,
    });

    // 4. Start chat session with history and send the latest message
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(latestMessage);
    const responseText = result.response.text();

    return NextResponse.json({ message: responseText });

  } catch (error: any) {
    // 5. Expose the real error message in dev — helps debugging model/API issues
    const errorMessage = error?.message || "Unknown error occurred.";
    console.error("Gemini Chat API Error:", errorMessage, error);
    return NextResponse.json(
      { error: `Gemini API Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
