import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import InlineSupportError from '@/components/management/InlineSupportError';
import { cn } from '@/lib/utils';
import { useManagementStore } from '@/stores/management-store';
import type {
  HealthComponentId,
  HealthSnapshot,
  HealthSeverity,
  VersionKey,
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

function toSeverityClassName(
  severity?: HealthSeverity,
  componentId?: HealthComponentId
): string | undefined {
  if (!severity) {
    return 'bg-muted text-foreground';
  }

  if (severity === 'Healthy') {
    return 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950';
  }

  if (severity === 'Warning') {
    if (componentId === 'runtime') {
      return 'bg-destructive text-destructive-foreground';
    }
    return 'bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950';
  }

  return 'bg-destructive text-destructive-foreground';
}

function getSeverityIcon(severity?: HealthSeverity): LucideIcon {
  if (!severity) {
    return CircleHelp;
  }

  if (severity === 'Healthy') {
    return CheckCircle2;
  }

  if (severity === 'Warning') {
    return AlertTriangle;
  }

  return XCircle;
}

function toSeverityIconClassName(severity?: HealthSeverity, componentId?: HealthComponentId): string {
  if (!severity) {
    return 'text-muted-foreground';
  }

  if (severity === 'Healthy') {
    return 'text-emerald-600 dark:text-emerald-400';
  }

  if (severity === 'Warning') {
    if (componentId === 'runtime') {
      return 'text-destructive';
    }
    return 'text-amber-500 dark:text-amber-400';
  }

  return 'text-destructive';
}

function getVersionSeverity(key: VersionKey, value: string | null): HealthSeverity {
  if (value) {
    return 'Healthy';
  }

  return 'Warning';
}

function getVersionWarningMessage(key: VersionKey, value: string | null): string | null {
  if (value) {
    return null;
  }

  if (key === 'docker') {
    return 'Docker daemon is not running or not reachable.';
  }

  if (key === 'app') {
    return 'App version could not be resolved.';
  }

  return `${key} is not available on this machine.`;
}

function renderComponentStatus(componentId: HealthComponentId, severity?: HealthSeverity): string {
  if (!severity) {
    return 'No data';
  }

  if (componentId === 'runtime' && severity === 'Warning') {
    return 'Not running';
  }

  return severity;
}

function getNonWorkingElements(snapshot: HealthSnapshot | null): string[] {
  if (!snapshot) {
    return ['Health snapshot is unavailable.'];
  }

  const issues: string[] = [];
  const componentIds = Object.keys(HEALTH_COMPONENT_LABELS) as HealthComponentId[];

  for (const componentId of componentIds) {
    const severity = snapshot.components[componentId];
    if (severity === 'Healthy') {
      continue;
    }

    issues.push(`${HEALTH_COMPONENT_LABELS[componentId]}: ${renderComponentStatus(componentId, severity)}`);
  }

  const versionEntries = Object.entries(snapshot.versions) as Array<
    [keyof HealthSnapshot['versions'], string | null]
  >;
  for (const [key, value] of versionEntries) {
    if (!value) {
      issues.push(`${key}: Not available`);
    }
  }

  return issues;
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
    exportDiagnostics,
  } = useManagementStore();

  const [darkMode, setDarkMode] = useState(false);
  const [stackUninstalling, setStackUninstalling] = useState(false);
  const [stackUninstallError, setStackUninstallError] = useState<string | null>(null);
  const [stackUninstallResult, setStackUninstallResult] = useState<string | null>(null);

  const nonWorkingElements = useMemo(() => getNonWorkingElements(healthSnapshot ?? null), [healthSnapshot]);
  const versionRows = useMemo(
    () =>
      (['app', 'openclaw', 'nemoclaw', 'docker'] as VersionKey[]).map((key) => {
        const value = healthSnapshot?.versions[key] ?? null;
        const severity = getVersionSeverity(key, value);

        return {
          key,
          value,
          severity,
        };
      }),
    [healthSnapshot]
  );

  const getWarningTooltip = (severity?: HealthSeverity): string[] =>
    severity === 'Warning' ? nonWorkingElements : [];

  useEffect(() => {
    const initial = readTheme();
    setDarkMode(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

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
          <TooltipProvider>
            {getWarningTooltip(healthSnapshot?.overallSeverity).length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-transparent',
                        toSeverityClassName(healthSnapshot?.overallSeverity)
                      )}
                    >
                      {healthSnapshot?.overallSeverity ?? 'No data'}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <div className="space-y-1">
                    <p className="font-semibold">Non-working elements</p>
                    {nonWorkingElements.map((item) => (
                      <p key={`overall-${item}`}>{item}</p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent',
                  toSeverityClassName(healthSnapshot?.overallSeverity)
                )}
              >
                {healthSnapshot?.overallSeverity ?? 'No data'}
              </Badge>
            )}
          </TooltipProvider>
        </div>

        <div className="rounded-md border">
          <TooltipProvider>
            <div className="space-y-2 p-3">
              {versionRows.map((row) => {
                const StatusIcon = getSeverityIcon(row.severity);
                const warningMessage = getVersionWarningMessage(row.key, row.value);
                const icon = (
                  <StatusIcon className={cn('size-4', toSeverityIconClassName(row.severity))} />
                );

                return (
                  <div key={row.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <p className="font-medium">{row.key}</p>

                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{row.value ?? 'Not available'}</p>
                      {warningMessage ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{icon}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={8}>
                            <p>{warningMessage}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        icon
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
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
