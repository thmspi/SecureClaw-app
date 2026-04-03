import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useManagementStore } from '@/stores/management-store';

export default function PluginCatalog() {
  const {
    pluginPackages,
    selectedPluginIds,
    pluginsLoading,
    pluginMutationInFlight,
    pluginError,
    loadPluginPackages,
    togglePluginSelected,
    validatePluginPackage,
    importPluginPackage,
    clearPluginError,
  } = useManagementStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [validationPassed, setValidationPassed] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedPluginIds), [selectedPluginIds]);

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

    const result = await validatePluginPackage(trimmed);
    if (!result.valid) {
      setValidationPassed(false);
      setValidationMessage(result.error ?? `Plugin ${trimmed} is not valid.`);
      return;
    }

    setValidationPassed(true);
    setValidationMessage(`Plugin ${trimmed} is valid.`);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Plugin Packages</h3>
          <p className="text-sm text-muted-foreground">
            Select plugins to apply automatically to new sessions.
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
              <Button>Import Plugin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Plugin Package</DialogTitle>
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
                {(validationMessage || pluginError) && (
                  <p className="text-sm text-muted-foreground">{validationMessage ?? pluginError}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleValidate} disabled={pluginMutationInFlight}>
                  Verify
                </Button>
                <Button onClick={handleImport} disabled={!validationPassed || pluginMutationInFlight}>
                  {pluginMutationInFlight ? 'Importing...' : 'Import'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pluginError && <p className="text-sm text-destructive">{pluginError}</p>}

      <div className="rounded-lg border">
        <div className="max-h-[26rem] overflow-y-auto">
          {pluginPackages.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {pluginsLoading
                ? 'Loading plugin packages...'
                : 'No plugin packages detected. Import a plugin to get started.'}
            </div>
          ) : (
            <ul className="divide-y">
              {pluginPackages.map((plugin) => (
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
                    {plugin.description && (
                      <p className="text-sm text-muted-foreground">{plugin.description}</p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={selectedSet.has(plugin.id)}
                      onCheckedChange={() => togglePluginSelected(plugin.id)}
                    />
                    Selected
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {selectedPluginIds.length} plugin{selectedPluginIds.length === 1 ? '' : 's'} selected for new sessions.
      </p>
    </div>
  );
}
