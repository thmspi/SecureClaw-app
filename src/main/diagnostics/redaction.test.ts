import { redactJsonValue, redactText } from './redaction';

describe('redaction', () => {
  it('redacts tokens, secrets, user paths, and emails with per-matcher counts', () => {
    const input = [
      'Authorization: Bearer abc123',
      'api_key=topsecret',
      'secret: hidden',
      'Path: /Users/alice/project',
      'Email: alice@example.com',
    ].join('\n');

    const result = redactText(input);

    expect(result.redacted).toContain('Bearer [REDACTED_TOKEN]');
    expect(result.redacted).toContain('api_key=[REDACTED_SECRET]');
    expect(result.redacted).toContain('secret: [REDACTED_SECRET]');
    expect(result.redacted).toContain('/Users/[REDACTED_USER]');
    expect(result.redacted).toContain('[REDACTED_EMAIL]');
    expect(result.summary).toEqual({
      tokenMatches: 1,
      secretMatches: 2,
      pathMatches: 1,
      emailMatches: 1,
    });
  });

  it('redacts nested JSON payloads and reports D-11 summary counters', () => {
    const payload = {
      auth: 'Bearer tok_1',
      credentials: {
        token: 'tok_2',
        password: 'pw',
      },
      profile: {
        email: 'user@example.com',
        home: '/Users/bob/dev',
      },
    };

    const result = redactJsonValue(payload);

    expect(result.redacted).toEqual({
      auth: 'Bearer [REDACTED_TOKEN]',
      credentials: {
        token: '[REDACTED_SECRET]',
        password: '[REDACTED_SECRET]',
      },
      profile: {
        email: '[REDACTED_EMAIL]',
        home: '/Users/[REDACTED_USER]/dev',
      },
    });
    expect(result.summary).toEqual({
      tokenMatches: 1,
      secretMatches: 2,
      pathMatches: 1,
      emailMatches: 1,
    });
  });
});
