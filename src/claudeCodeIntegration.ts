import { OpenRouter } from '@openrouterai/openrouter';

const apiKey = process.env.OPENROUTER_API_KEY;
const client = new OpenRouter(apiKey);

const API_CONFIG = {
  model: 'liquid/lfm-2.5-1.2b-instruct:free',
  maxTokens: 1024,
  apiKey,
  provider: 'openai/gpt-oss-120b:free'
};

async function generateCode(prompt: string) {
  try {
    const response = await client.completion.create({
      model: API_CONFIG.model,
      prompt,
      max_tokens: API_CONFIG.maxTokens
    });

    console.log('Generated code:', response.choices?.[0]?.text);
  } catch (error) {
    console.error('Error generating code:', error);
  }
}

generateCode('Write a function to calculate factorial');














































































































































































