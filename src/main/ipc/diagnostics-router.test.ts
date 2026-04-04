import {
  DIAGNOSTICS_CHANNELS,
  exportBundleSchema,
  getHealthSchema,
} from '../../shared/ipc/diagnostics-channels';

describe('diagnostics-router scaffold', () => {
  it('uses versioned diagnostics:v1 channels', () => {
    expect(DIAGNOSTICS_CHANNELS.getHealth).toBe('diagnostics:v1:getHealth');
    expect(DIAGNOSTICS_CHANNELS.exportBundle).toBe('diagnostics:v1:exportBundle');
  });

  it('validates request payloads for diagnostics handlers', () => {
    expect(getHealthSchema.parse({ forceRefresh: true }).forceRefresh).toBe(true);
    expect(exportBundleSchema.parse({ includeDays: 7 }).includeDays).toBe(7);
  });
});
