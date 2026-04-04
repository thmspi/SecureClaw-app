export interface RedactionMatcherSummary {
  tokenMatches: number;
  secretMatches: number;
  pathMatches: number;
  emailMatches: number;
}

export interface RedactionResult<T> {
  redacted: T;
  summary: RedactionMatcherSummary;
}

const TOKEN_REGEX = /\bBearer\s+([^\s,;]+)/gi;
const SECRET_KEY_VALUE_REGEX = /\b(api_key|token|secret|password)\b(\s*[:=]\s*)([^\s,;]+)/gi;
const USER_PATH_REGEX = /\/Users\/([A-Za-z0-9._-]+)/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const SECRET_KEY_REGEX = /^(api_key|token|secret|password)$/i;

function emptySummary(): RedactionMatcherSummary {
  return {
    tokenMatches: 0,
    secretMatches: 0,
    pathMatches: 0,
    emailMatches: 0,
  };
}

function mergeSummary(target: RedactionMatcherSummary, incoming: RedactionMatcherSummary): RedactionMatcherSummary {
  target.tokenMatches += incoming.tokenMatches;
  target.secretMatches += incoming.secretMatches;
  target.pathMatches += incoming.pathMatches;
  target.emailMatches += incoming.emailMatches;
  return target;
}

function applyRegexReplacement(
  input: string,
  summaryKey: keyof RedactionMatcherSummary,
  regex: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
  summary: RedactionMatcherSummary
): string {
  let count = 0;
  const output = input.replace(regex, (...args) => {
    count += 1;
    if (typeof replacement === 'function') {
      return replacement(args[0], ...(args.slice(1, -2) as string[]));
    }
    return replacement;
  });
  summary[summaryKey] += count;
  return output;
}

function redactStringValue(value: string): RedactionResult<string> {
  const summary = emptySummary();
  let redacted = value;

  redacted = applyRegexReplacement(redacted, 'tokenMatches', TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]', summary);
  redacted = applyRegexReplacement(
    redacted,
    'secretMatches',
    SECRET_KEY_VALUE_REGEX,
    (_full, key, separator) => `${key}${separator}[REDACTED_SECRET]`,
    summary
  );
  redacted = applyRegexReplacement(redacted, 'pathMatches', USER_PATH_REGEX, '/Users/[REDACTED_USER]', summary);
  redacted = applyRegexReplacement(redacted, 'emailMatches', EMAIL_REGEX, '[REDACTED_EMAIL]', summary);

  return { redacted, summary };
}

function redactUnknownValue(value: unknown, keyName: string | null): RedactionResult<unknown> {
  if (typeof value === 'string') {
    if (keyName && SECRET_KEY_REGEX.test(keyName)) {
      return {
        redacted: '[REDACTED_SECRET]',
        summary: { tokenMatches: 0, secretMatches: 1, pathMatches: 0, emailMatches: 0 },
      };
    }

    return redactStringValue(value);
  }

  if (Array.isArray(value)) {
    const summary = emptySummary();
    const redacted = value.map((entry) => {
      const result = redactUnknownValue(entry, null);
      mergeSummary(summary, result.summary);
      return result.redacted;
    });
    return { redacted, summary };
  }

  if (value && typeof value === 'object') {
    const summary = emptySummary();
    const source = value as Record<string, unknown>;
    const redactedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(source)) {
      const result = redactUnknownValue(nestedValue, key);
      redactedObject[key] = result.redacted;
      mergeSummary(summary, result.summary);
    }

    return { redacted: redactedObject, summary };
  }

  return {
    redacted: value,
    summary: emptySummary(),
  };
}

export function redactText(input: string): RedactionResult<string> {
  return redactStringValue(input);
}

export function redactJsonValue<T>(value: T): RedactionResult<T> {
  const result = redactUnknownValue(value, null);
  return {
    redacted: result.redacted as T,
    summary: result.summary,
  };
}

export function combineRedactionSummaries(summaries: RedactionMatcherSummary[]): RedactionMatcherSummary {
  return summaries.reduce((accumulator, current) => mergeSummary(accumulator, current), emptySummary());
}
