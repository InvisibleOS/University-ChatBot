import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const googleAI = createGoogleGenerativeAI({ apiKey: "dummy" });

async function run() {
  const result = await streamText({
    model: googleAI('gemini-1.5-flash'),
    messages: [{ role: 'user', content: 'hi' }]
  });
  console.log(Object.keys(result));
}
run().catch(console.error);
