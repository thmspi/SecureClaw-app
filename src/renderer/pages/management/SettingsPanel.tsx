import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useManagementStore } from '@/stores/management-store';

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

export default function SettingsPanel() {
  const { pluginPackages, pluginMutationInFlight, uninstallPluginPackage, loadPluginPackages } =
    useManagementStore();

  const [darkMode, setDarkMode] = useState(false);
  const [uninstallError, setUninstallError] = useState<string | null>(null);

  useEffect(() => {
    const initial = readTheme();
    setDarkMode(initial);
    applyTheme(initial);
  }, []);

  const installedPlugins = useMemo(() => pluginPackages, [pluginPackages]);

  const handleThemeToggle = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  };

  const handleUninstall = async (pluginId: string) => {
    setUninstallError(null);
    const result = await uninstallPluginPackage(pluginId);
    if (!result.uninstalled) {
      setUninstallError(result.error ?? `Failed to uninstall ${pluginId}`);
      return;
    }

    await loadPluginPackages();
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

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Uninstall Packages</h3>
          <Badge variant="secondary">{installedPlugins.length} installed</Badge>
        </div>

        {uninstallError && <p className="text-sm text-destructive">{uninstallError}</p>}

        {installedPlugins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plugin packages are currently installed.</p>
        ) : (
          <ul className="space-y-2">
            {installedPlugins.map((plugin) => (
              <li
                key={plugin.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{plugin.displayName}</p>
                  <p className="text-xs text-muted-foreground">{plugin.id}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pluginMutationInFlight}
                  onClick={() => void handleUninstall(plugin.id)}
                >
                  Uninstall
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
