import OpenAI from 'openai';

export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL,
  timeout: 180000,
});

export const LLM_MODEL = process.env.LLM_MODEL!;
export const LLM_PROVIDER = process.env.LLM_PROVIDER!;
