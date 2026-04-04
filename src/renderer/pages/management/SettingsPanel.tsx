import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import InlineSupportError from '@/components/management/InlineSupportError';
import { useManagementStore } from '@/stores/management-store';
import type {
  HealthComponentId,
  HealthSeverity,
} from '../../../shared/diagnostics/diagnostics-contracts';

const THEME_STORAGE_KEY = 'secureclaw-theme';

function applyTheme(darkMode: boolean): void {
  document.documentElement.classList.toggle('dark', darkMode);
  localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
}

function readTheme(): boolean {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark') {
    return true;
  }
  if (stored === 'light') {
    return false;
  }
  return document.documentElement.classList.contains('dark');
}

function toSeverityVariant(severity: HealthSeverity): 'default' | 'secondary' | 'destructive' {
  if (severity === 'Critical') {
    return 'destructive';
  }
  if (severity === 'Warning') {
    return 'secondary';
  }
  return 'default';
}

const HEALTH_COMPONENT_LABELS: Record<HealthComponentId, string> = {
  install: 'Install',
  runtime: 'Runtime',
  plugins: 'Plugins',
};

export default function SettingsPanel() {
  const {
    healthSnapshot,
    healthLoading,
    healthError,
    diagnosticsExporting,
    diagnosticsExportPath,
    diagnosticsError,
    loadHealth,
    refreshHealth,
    startHealthAutoRefresh,
    stopHealthAutoRefresh,
    exportDiagnostics,
  } = useManagementStore();

  const [darkMode, setDarkMode] = useState(false);
  const [stackUninstalling, setStackUninstalling] = useState(false);
  const [stackUninstallError, setStackUninstallError] = useState<string | null>(null);
  const [stackUninstallResult, setStackUninstallResult] = useState<string | null>(null);

  const componentEntries = useMemo(
    () =>
      (Object.keys(HEALTH_COMPONENT_LABELS) as HealthComponentId[]).map((componentId) => ({
        componentId,
        label: HEALTH_COMPONENT_LABELS[componentId],
        severity: healthSnapshot?.components[componentId],
      })),
    [healthSnapshot]
  );

  useEffect(() => {
    const initial = readTheme();
    setDarkMode(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    void loadHealth();
    startHealthAutoRefresh();
    return () => {
      stopHealthAutoRefresh();
    };
  }, [loadHealth, startHealthAutoRefresh, stopHealthAutoRefresh]);

  const handleThemeToggle = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  };

  const handleStackUninstall = async () => {
    const confirmed = window.confirm(
      'This will uninstall OpenClaw and NemoClaw binaries from this machine. Continue?'
    );
    if (!confirmed) {
      return;
    }

    setStackUninstalling(true);
    setStackUninstallError(null);
    setStackUninstallResult(null);

    try {
      const result = await window.secureClaw.install.uninstallStack();
      if (result.errors && result.errors.length > 0) {
        setStackUninstallError(result.errors.join('\n'));
      }

      if (result.removed.length === 0) {
        setStackUninstallResult('No OpenClaw/NemoClaw binaries were removed.');
        return;
      }

      setStackUninstallResult(`Removed: ${result.removed.join(', ')}`);
    } catch (error) {
      setStackUninstallError(error instanceof Error ? error.message : String(error));
    } finally {
      setStackUninstalling(false);
    }
  };

  const handleRefreshHealth = async () => {
    await refreshHealth();
  };

  const handleExportDiagnostics = async () => {
    await exportDiagnostics(7);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Appearance</h3>
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox checked={darkMode} onCheckedChange={handleThemeToggle} />
          Dark mode
        </label>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Health</h3>
          <p className="text-sm text-muted-foreground">
            Track install/runtime/plugins health and export diagnostics for IT support.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Overall:</span>
          <Badge variant={toSeverityVariant(healthSnapshot?.overallSeverity ?? 'Warning')}>
            {healthSnapshot?.overallSeverity ?? 'No data'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {componentEntries.map((entry) => (
            <Badge
              key={entry.componentId}
              variant={toSeverityVariant(entry.severity ?? 'Warning')}
              className="capitalize"
            >
              {entry.label}: {entry.severity ?? 'No data'}
            </Badge>
          ))}
        </div>

        <div className="rounded-md border">
          <div className="grid grid-cols-1 gap-2 p-3 text-sm sm:grid-cols-2">
            <p className="font-medium">app</p>
            <p className="text-muted-foreground">{healthSnapshot?.versions.app ?? 'Not available'}</p>

            <p className="font-medium">openclaw</p>
            <p className="text-muted-foreground">{healthSnapshot?.versions.openclaw ?? 'Not available'}</p>

            <p className="font-medium">nemoclaw</p>
            <p className="text-muted-foreground">{healthSnapshot?.versions.nemoclaw ?? 'Not available'}</p>

            <p className="font-medium">docker</p>
            <p className="text-muted-foreground">{healthSnapshot?.versions.docker ?? 'Not available'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={healthLoading} onClick={() => void handleRefreshHealth()}>
            {healthLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button disabled={diagnosticsExporting} onClick={() => void handleExportDiagnostics()}>
            {diagnosticsExporting ? 'Exporting...' : 'Export Diagnostics (.zip)'}
          </Button>
        </div>

        {healthSnapshot?.generatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(healthSnapshot.generatedAt).toLocaleString()}
          </p>
        )}

        {diagnosticsExportPath && (
          <p className="text-sm text-muted-foreground">Diagnostics bundle ready: {diagnosticsExportPath}</p>
        )}

        {healthError && (
          <InlineSupportError
            title="Health Check Error"
            error={healthError}
            onRetry={healthError.retryable ? () => void handleRefreshHealth() : undefined}
          />
        )}

        {diagnosticsError && (
          <InlineSupportError
            title="Diagnostics Export Error"
            error={diagnosticsError}
            onRetry={diagnosticsError.retryable ? () => void handleExportDiagnostics() : undefined}
          />
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-base font-semibold">Uninstall Stack</h3>
        <p className="text-sm text-muted-foreground">
          Remove OpenClaw and NemoClaw binaries from this machine.
        </p>
        <Button variant="destructive" disabled={stackUninstalling} onClick={() => void handleStackUninstall()}>
          {stackUninstalling ? 'Uninstalling...' : 'Uninstall OpenClaw + NemoClaw'}
        </Button>
        {stackUninstallError && <p className="whitespace-pre-wrap text-sm text-destructive">{stackUninstallError}</p>}
        {stackUninstallResult && <p className="text-sm text-muted-foreground">{stackUninstallResult}</p>}
      </section>
    </div>
  );
}
