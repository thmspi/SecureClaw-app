import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [darkMode, setDarkMode] = useState(false);
  const [stackUninstalling, setStackUninstalling] = useState(false);
  const [stackUninstallError, setStackUninstallError] = useState<string | null>(null);
  const [stackUninstallResult, setStackUninstallResult] = useState<string | null>(null);

  useEffect(() => {
    const initial = readTheme();
    setDarkMode(initial);
    applyTheme(initial);
  }, []);

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
