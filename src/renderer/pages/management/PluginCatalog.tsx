import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import InlineSupportError, {
  classifyRuntimeStringError,
} from '@/components/management/InlineSupportError';
import { useManagementStore } from '@/stores/management-store';
import type { PluginPackage } from '../../../shared/runtime/runtime-contracts';

const CATEGORY_ORDER: Array<NonNullable<PluginPackage['category']>> = [
  'Channel',
  'Model Provider',
  'Memory',
  'Speech',
  'Media Understanding',
  'Image Generation',
  'Web Search',
  'Tool',
  'Command',
  'Hook',
  'Service',
  'Other',
];

function sortPluginsByName(plugins: PluginPackage[]): PluginPackage[] {
  return [...plugins].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default function PluginCatalog() {
  const {
    pluginPackages,
    pluginsLoading,
    pluginMutationInFlight,
    pluginError,
    loadPluginPackages,
    validatePluginPackage,
    importPluginPackage,
    uninstallPluginPackage,
    setPluginPackageEnabled,
    clearPluginError,
  } = useManagementStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [validationPassed, setValidationPassed] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationInFlight, setValidationInFlight] = useState(false);

  const nativeUninstallablePlugins = useMemo(
    () => sortPluginsByName(pluginPackages.filter((plugin) => plugin.removable === false)),
    [pluginPackages]
  );
  const pluginSupportError = useMemo(
    () => (pluginError ? classifyRuntimeStringError(pluginError, 'complete this plugin action') : null),
    [pluginError]
  );

  const categorizedPlugins = useMemo(() => {
    const groupMap = new Map<NonNullable<PluginPackage['category']>, PluginPackage[]>();
    pluginPackages
      .filter((plugin) => plugin.removable !== false)
      .forEach((plugin) => {
        const category = plugin.category ?? 'Other';
        const current = groupMap.get(category) ?? [];
        current.push(plugin);
        groupMap.set(category, current);
      });

    return CATEGORY_ORDER.map((category) => ({
      category,
      plugins: sortPluginsByName(groupMap.get(category) ?? []),
    })).filter((entry) => entry.plugins.length > 0);
  }, [pluginPackages]);

  const resetDialogState = () => {
    setPackageName('');
    setValidationPassed(false);
    setValidationMessage(null);
    clearPluginError();
  };

  const handleValidate = async () => {
    clearPluginError();
    const trimmed = packageName.trim();
    if (!trimmed) {
      setValidationPassed(false);
      setValidationMessage('Enter a plugin package name first.');
      return;
    }

    setValidationInFlight(true);
    try {
      const result = await validatePluginPackage(trimmed);
      if (!result.valid) {
        setValidationPassed(false);
        setValidationMessage(result.error ?? `Plugin ${trimmed} is not valid.`);
        return;
      }

      setValidationPassed(true);
      setValidationMessage(`Plugin ${trimmed} is valid.`);
    } finally {
      setValidationInFlight(false);
    }
  };

  const handleImport = async () => {
    const trimmed = packageName.trim();
    if (!trimmed || !validationPassed) {
      return;
    }

    const result = await importPluginPackage(trimmed);
    if (!result.imported) {
      setValidationMessage(result.error ?? `Failed to import ${trimmed}.`);
      return;
    }

    setDialogOpen(false);
    resetDialogState();
  };

  const handleRemove = async (pluginId: string) => {
    clearPluginError();
    const result = await uninstallPluginPackage(pluginId);
    if (!result.uninstalled) {
      return;
    }
  };

  const handleToggleEnabled = async (pluginId: string, enabled: boolean) => {
    clearPluginError();
    await setPluginPackageEnabled(pluginId, enabled);
  };

  const renderPluginRow = (plugin: PluginPackage) => {
    return (
      <li key={plugin.id} className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{plugin.displayName}</p>
            {plugin.version && <Badge variant="secondary">v{plugin.version}</Badge>}
            <Badge variant={plugin.enabled ? 'default' : 'outline'}>
              {plugin.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">ID: {plugin.id}</p>
          {plugin.description && <p className="text-sm text-muted-foreground">{plugin.description}</p>}
          {plugin.origin && <p className="text-xs text-muted-foreground">Origin: {plugin.origin}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pluginMutationInFlight}
            onClick={() => void handleToggleEnabled(plugin.id, !plugin.enabled)}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pluginMutationInFlight || plugin.removable === false}
            onClick={() => void handleRemove(plugin.id)}
          >
            Remove
          </Button>
          {plugin.removable === false && (
            <p className="text-xs text-muted-foreground">Native (uninstall blocked)</p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Plugin Packages</h3>
          <p className="text-sm text-muted-foreground">
            Loaded and installable OpenClaw plugins from your local runtime.
          </p>
          <p className="text-xs text-muted-foreground">
            Plugin enablement/config changes are applied by OpenClaw after gateway restart.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadPluginPackages()} disabled={pluginsLoading}>
            {pluginsLoading ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                resetDialogState();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>Add Plugin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Plugin Package</DialogTitle>
                <DialogDescription>
                  Enter a plugin name from OpenClaw registry, validate it, then import it.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <Input
                  placeholder="example: @acme/security-plugin"
                  value={packageName}
                  onChange={(event) => {
                    setPackageName(event.target.value);
                    setValidationPassed(false);
                    setValidationMessage(null);
                  }}
                />
                {validationMessage && <p className="text-sm text-muted-foreground">{validationMessage}</p>}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={pluginMutationInFlight || validationInFlight || packageName.trim().length === 0}
                >
                  {validationInFlight ? 'Verifying...' : 'Verify'}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!validationPassed || pluginMutationInFlight || validationInFlight}
                >
                  {pluginMutationInFlight ? 'Importing...' : 'Import'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pluginSupportError && (
        <InlineSupportError
          title="Plugin Catalog Error"
          error={pluginSupportError}
          onRetry={pluginSupportError.retryable ? () => void loadPluginPackages() : undefined}
        />
      )}

      <div className="rounded-lg border">
        <div className="max-h-[26rem] overflow-y-auto">
          {pluginPackages.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {pluginsLoading
                ? 'Loading plugin packages...'
                : 'No plugin packages detected. Import a plugin to get started.'}
            </div>
          ) : (
            <div className="space-y-2 p-2">
              <details className="overflow-hidden rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  Native (Uninstallable) ({nativeUninstallablePlugins.length})
                </summary>
                {nativeUninstallablePlugins.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No native uninstall-blocked plugins detected.</p>
                ) : (
                  <ul className="divide-y">{nativeUninstallablePlugins.map(renderPluginRow)}</ul>
                )}
              </details>

              {categorizedPlugins.map((entry) => (
                <details key={entry.category} className="overflow-hidden rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                    {entry.category} ({entry.plugins.length})
                  </summary>
                  <ul className="divide-y">{entry.plugins.map(renderPluginRow)}</ul>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
