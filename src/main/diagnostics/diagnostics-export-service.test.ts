describe('diagnostics-export-service scaffold', () => {
  it('captures expected D-10 artifact names for ZIP exports', () => {
    const expectedArtifacts = [
      'health-snapshot.json',
      'component-versions.json',
      'operation-history.json',
      'redaction-summary.json',
    ];

    expect(expectedArtifacts).toContain('redaction-summary.json');
    expect(expectedArtifacts).toContain('operation-history.json');
  });
});
