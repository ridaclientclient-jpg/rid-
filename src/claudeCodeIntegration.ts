import { OpenRouter } from '@openrouterai/openrouter';

const apiKey = 'REMOVED';
const client = new OpenRouter(apiKey);

// Configuration for free API usage
const API_CONFIG = {
  model: 'openrouter/free',  // Free tier model
  maxTokens: 1024,          // Adjust based on your needs
  apiKey: 'REMOVED',
  provider: 'openai/gpt-oss-120b:free'    // Can switch to 'another-free-provider' easily
};

// Main function with free tier awareness
async function generateCode(prompt: string) {
  try {
    const response = await client.completion.create({
      model: 'openrouter/free',
      prompt: prompt,
      max_tokens: MAX_TOKENS
    }

const MAX_TOKENS = 1024;);
    console.log('Generated code:', response.choices[0].text);
  } catch (error) {
    console.error('Error generating code:', error);
  }
}

// Example usage:
generateCode('Write a function to calculate factorial');

