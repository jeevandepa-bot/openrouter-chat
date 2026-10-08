import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Golden Glass AI',
  },
});

export async function POST(req: Request) {
  try {
    const { messages, model, systemInstruction } = await req.json();

    if (!process.env.OPENROUTER_API_KEY) {
       return new Response(JSON.stringify({ error: "API ledu ra laude !" }), { status: 500 });
    }

    const result = await streamText({
      model: openrouter(model || 'openrouter/free'),
      system: systemInstruction || undefined,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    return new Response(JSON.stringify({ error: "API ledu ra laude !" }), { status: 500 });
  }
}
