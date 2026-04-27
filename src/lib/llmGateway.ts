import Anthropic from '@anthropic-ai/sdk';

export type LlmRequest = {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

export type LlmResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

function shouldUseOpenAICompat(model: string): boolean {
  return Boolean(
    process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
    process.env.AICREDITS_BASE_URL?.trim() ||
    model.includes('/'),
  );
}

async function requestOpenAICompatibleCompletion(req: LlmRequest): Promise<LlmResponse> {
  const baseUrl = (
    process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
    process.env.AICREDITS_BASE_URL?.trim() ||
    'https://api.aicredits.in/v1'
  ).replace(/\/$/, '');

  const apiKey =
    process.env.AICREDITS_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    '';

  if (!apiKey) {
    throw new Error('No API key configured for OpenAI-compatible gateway.');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature ?? 0,
      max_tokens: req.maxTokens ?? 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${errorText}`);
  }

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = normalizeContent(json.choices?.[0]?.message?.content);

  return {
    text,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

async function requestAnthropicCompletion(req: LlmRequest): Promise<LlmResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const anthropic = new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL?.trim() ? { baseURL: process.env.ANTHROPIC_BASE_URL.trim() } : {}),
  });

  const message = await anthropic.messages.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 500,
    temperature: req.temperature ?? 0,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  return {
    text,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };
}

export async function requestLlmCompletion(req: LlmRequest): Promise<LlmResponse> {
  if (shouldUseOpenAICompat(req.model)) {
    return requestOpenAICompatibleCompletion(req);
  }
  return requestAnthropicCompletion(req);
}
