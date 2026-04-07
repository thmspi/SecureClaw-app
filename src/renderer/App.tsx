import { useEffect, useState } from 'react';
import ManagementPage from '@/pages/management/ManagementPage';
import { WizardPage } from '@/pages/wizard/WizardPage';
import { clearPersistedZustandStorage } from '@/lib/zustand-storage';
import { useWizardStore } from '@/stores/wizard-store';

interface RouteProps {
  path: string;
  currentPath: string;
  children: React.ReactNode;
}

function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }
  return path.replace(/\/+$/, '');
}

function Route({ path, currentPath, children }: RouteProps) {
  return currentPath === path ? <>{children}</> : null;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const installStatus = useWizardStore((state) => state.install.status);
  const currentStep = useWizardStore((state) => state.currentStep);
  const resetWizard = useWizardStore((state) => state.reset);

  // Dev helper: Press Cmd+Shift+R to reset install wizard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        console.log('[DEV] Resetting install wizard...');
        resetWizard();
        clearPersistedZustandStorage(localStorage);
        window.history.pushState({}, '', '/');
        window.location.reload();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [resetWizard]);

  useEffect(() => {
    const onPathChange = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', onPathChange);
    window.addEventListener('secureclaw:navigate', onPathChange as EventListener);

    return () => {
      window.removeEventListener('popstate', onPathChange);
      window.removeEventListener('secureclaw:navigate', onPathChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const shouldOpenManagement = installStatus === 'completed' || currentStep === 'complete';
    if (!shouldOpenManagement || currentPath === '/management') {
      return;
    }

    window.history.pushState({}, '', '/management');
    setCurrentPath('/management');
  }, [installStatus, currentStep, currentPath]);

  const path = currentPath === '/management' ? '/management' : '/';

  return (
    <>
      <Route path="/" currentPath={path}>
        <WizardPage />
      </Route>
      <Route path="/management" currentPath={path}>
        <ManagementPage />
      </Route>
    </>
  );
}
