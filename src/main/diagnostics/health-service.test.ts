describe('health-service scaffold', () => {
  it('captures D-06 health component keys', () => {
    const components = {
      install: 'Healthy',
      runtime: 'Warning',
      plugins: 'Critical',
    };

    expect(Object.keys(components).sort()).toEqual(['install', 'plugins', 'runtime']);
  });
});
