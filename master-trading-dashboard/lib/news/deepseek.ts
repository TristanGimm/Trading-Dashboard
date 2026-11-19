export type DeepSeekResult = {
  raw: unknown;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
};

export class DeepSeekError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'DeepSeekError';
    this.status = status;
  }
}

function escapeControlCharacters(text: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (!inString) {
      if (char === '"') inString = true;
      output += char;
      continue;
    }
    if (escaped) { output += char; escaped = false; continue; }
    if (char === '\\') { output += char; escaped = true; continue; }
    if (char === '"') { output += char; inString = false; continue; }
    if (char === '\n') { output += '\\n'; continue; }
    if (char === '\r') { output += '\\r'; continue; }
    if (char === '\t') { output += '\\t'; continue; }
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20) { output += `\\u${code.toString(16).padStart(4, '0')}`; continue; }
    output += char;
  }
  return output;
}

export function parseDeepSeekJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const withoutTrailingCommas = (value: string) => value.replace(/,\s*([}\]])/g, '$1');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const sliced = start >= 0 && end > start ? cleaned.slice(start, end + 1) : null;

  const candidates = [...new Set([
    cleaned,
    withoutTrailingCommas(cleaned),
    escapeControlCharacters(cleaned),
    withoutTrailingCommas(escapeControlCharacters(cleaned)),
    ...(sliced ? [
      sliced,
      withoutTrailingCommas(sliced),
      escapeControlCharacters(sliced),
      withoutTrailingCommas(escapeControlCharacters(sliced)),
    ] : []),
  ])];

  const insertMissingComma = (value: string): unknown | null => {
    let candidate = value;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const position = /position (\d+)/.exec(message);
        if (!position) return null;
        const index = Number(position[1]);
        if (!Number.isFinite(index) || index < 0 || index > candidate.length) return null;
        const rest = candidate.slice(index).trimStart();
        const next = rest[0];
        // DeepSeek occasionally drops a comma between two properties or
        // array entries. The parser's own position tells us exactly where.
        if (next === '"' || next === '{' || next === '[' || /^[-\d]/.test(rest) || /^(true|false|null)/.test(rest)) {
          candidate = `${candidate.slice(0, index)},${candidate.slice(index)}`;
          continue;
        }
        return null;
      }
    }
    return null;
  };

  let lastMessage = 'unbekannter Fehler';
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : lastMessage;
    }
    const repaired = insertMissingComma(candidate);
    if (repaired !== null) return repaired;
  }
  const position = /position (\d+)/.exec(lastMessage);
  if (position && candidates[0]) {
    const index = Number(position[1]);
    console.error('[news] JSON failure context:', candidates[0].slice(Math.max(0, index - 220), index + 220));
  }
  throw new DeepSeekError(`DeepSeek lieferte ungültiges JSON (${lastMessage}).`);
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * One completion, JSON mode, one retry for transient upstream failures.
 * The API key never leaves the server process.
 */
export async function callDeepSeek(system: string, user: string): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new DeepSeekError('DEEPSEEK_API_KEY ist nicht gesetzt.');

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.32,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
          stream: false,
        }),
        signal: AbortSignal.timeout(240_000),
      });

      const text = await response.text();
      if (!response.ok) {
        let detail = text.slice(0, 300);
        try {
          const body = JSON.parse(text) as { error?: { message?: string } };
          detail = body.error?.message || detail;
        } catch { /* keep the raw body */ }
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new DeepSeekError(`DeepSeek ${response.status}: ${detail}`, response.status);
        if (retryable && attempt === 0) {
          await sleep(2_500);
          continue;
        }
        throw lastError;
      }

      const body = JSON.parse(text) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content || !content.trim()) throw new DeepSeekError('DeepSeek lieferte eine leere Antwort.');
      return {
        raw: parseDeepSeekJson(content),
        model: body.model || model,
        usage: body.usage ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
          totalTokens: body.usage.total_tokens ?? 0,
        } : null,
      };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof DeepSeekError
        ? error.status === null || error.status === 429 || error.status >= 500
        : error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (attempt === 0 && retryable) {
        await sleep(2_500);
        continue;
      }
      break;
    }
  }

  if (lastError instanceof DeepSeekError) throw lastError;
  throw new DeepSeekError(lastError instanceof Error ? `DeepSeek nicht erreichbar: ${lastError.message}` : 'DeepSeek nicht erreichbar.');
}
