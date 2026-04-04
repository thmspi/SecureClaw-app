describe('redaction scaffold', () => {
  it('defines D-11 summary counters for supported matchers', () => {
    const summary = {
      tokenMatches: 0,
      secretMatches: 0,
      pathMatches: 0,
      emailMatches: 0,
    };

    expect(summary.tokenMatches).toBe(0);
    expect(summary.secretMatches).toBe(0);
    expect(summary.pathMatches).toBe(0);
    expect(summary.emailMatches).toBe(0);
  });
});
