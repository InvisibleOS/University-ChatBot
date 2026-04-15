const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { embed } = require('ai');
require('dotenv').config({ path: '.env.local' });

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function test() {
  try {
    const { embedding } = await embed({
      model: googleAI.textEmbeddingModel('gemini-embedding-001'),
      value: 'Test string',
    });
    console.log('Embedding length:', embedding.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
