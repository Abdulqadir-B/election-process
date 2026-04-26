import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set." }, { status: 500 });
    }

    // Convert frontend messages to Gemini format
    const history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const latestMessage = messages[messages.length - 1].content;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: `You are a professional, authoritative, and helpful Civic Assistant for the official election website. 
      Your goal is to help the user find their election information.
      1. If you do not know the user's US state, politely ask them for it.
      2. If the user provides a state, you MUST search for the state's upcoming election polling location rules, key voter registration deadlines, and Voter ID requirements.
      3. CRITICAL: Once you have gathered the election information for the user's state, you MUST append a JSON block at the very end of your response containing the details. The JSON block must be formatted exactly like this:
      \`\`\`json
      {
        "type": "dashboard_update",
        "pollingLocation": "Brief summary of polling rules...",
        "deadlines": "Brief summary of key deadlines...",
        "idRequirements": "Brief summary of ID requirements..."
      }
      \`\`\`
      Keep your conversational response brief, professional, and encouraging. Rely on the JSON block to display the heavy data.`,
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.7,
            },
          },
        },
      ],
    }, { apiVersion: "v1beta" });

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(latestMessage);
    const responseText = result.response.text();

    return NextResponse.json({ message: responseText });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to process chat." }, { status: 500 });
  }
}
