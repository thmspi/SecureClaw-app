import {
  DIAGNOSTICS_CHANNELS,
  exportBundleSchema,
  getHealthSchema,
} from '../diagnostics-channels';
import {
  SECURITY_CHANNELS,
  deleteScopeSecretsSchema,
  deleteSecretSchema,
  getSecretSchema,
  setSecretSchema,
} from '../security-channels';

describe('Diagnostics and Security IPC Channels', () => {
  it('exposes versioned diagnostics channels and validates payload shape', () => {
    expect(DIAGNOSTICS_CHANNELS.getHealth).toBe('diagnostics:v1:getHealth');
    expect(DIAGNOSTICS_CHANNELS.exportBundle).toBe('diagnostics:v1:exportBundle');

    expect(getHealthSchema.parse({ forceRefresh: true }).forceRefresh).toBe(true);
    expect(exportBundleSchema.parse({}).includeDays).toBe(7);
  });

  it('exposes versioned secrets channels and validates scoped payload shapes', () => {
    expect(SECURITY_CHANNELS.set).toBe('secrets:v1:set');
    expect(SECURITY_CHANNELS.get).toBe('secrets:v1:get');
    expect(SECURITY_CHANNELS.delete).toBe('secrets:v1:delete');
    expect(SECURITY_CHANNELS.deleteScope).toBe('secrets:v1:deleteScope');

    const setPayload = setSecretSchema.parse({
      scope: 'runtime',
      name: 'token',
      value: 'abc',
    });
    const getPayload = getSecretSchema.parse({
      scope: 'runtime',
      name: 'token',
    });
    const deletePayload = deleteSecretSchema.parse({
      scope: 'runtime',
      name: 'token',
    });
    const deleteScopePayload = deleteScopeSecretsSchema.parse({
      scope: 'runtime',
    });

    expect(setPayload.value).toBe('abc');
    expect(getPayload.name).toBe('token');
    expect(deletePayload.scope).toBe('runtime');
    expect(deleteScopePayload.scope).toBe('runtime');
  });
});
