import OpenAI from 'openai'

export function buildLLMClient(): OpenAI {
  const baseURL = process.env.OLLAMA_BASE_URL
  if (!baseURL) throw new Error('OLLAMA_BASE_URL is not set in environment')

  const cfHeaders: Record<string, string> = {}
  if (process.env.CF_ACCESS_CLIENT_ID)
    cfHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
  if (process.env.CF_ACCESS_CLIENT_SECRET)
    cfHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET

  return new OpenAI({
    baseURL: `${baseURL}/v1`,
    apiKey: 'ollama',
    defaultHeaders: cfHeaders,
  })
}

export const LLM_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b'
