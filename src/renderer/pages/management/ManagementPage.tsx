import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  PanelLeft,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useManagementStore } from '@/stores/management-store';
import PluginCatalog from './PluginCatalog';
import SessionControl from './SessionControl';
import SettingsPanel from './SettingsPanel';

type ManagementTab = 'management' | 'configuration' | 'settings';

const NAV_ITEMS: Array<{
  id: ManagementTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'management', label: 'Management', icon: LayoutDashboard },
  { id: 'configuration', label: 'Configuration', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function ManagementPage() {
  const { loadSessions, loadPluginPackages } = useManagementStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ManagementTab>('management');
  const activeTabLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Management';

  useEffect(() => {
    void loadSessions();
    void loadPluginPackages();
  }, [loadSessions, loadPluginPackages]);

  useEffect(() => {
    const unsubscribeSession = window.secureClaw.runtime.onSessionEvent((event) => {
      useManagementStore.getState().handleSessionEvent(event);
    });

    return () => {
      unsubscribeSession();
    };
  }, []);

  const renderContent = () => {
    if (activeTab === 'configuration') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No additional configuration is available yet.</p>
          </CardContent>
        </Card>
      );
    }

    if (activeTab === 'settings') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsPanel />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Control</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionControl />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <PluginCatalog />
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-md shadow-sm"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={menuOpen ? 'Close panel menu' : 'Open panel menu'}
      >
        <PanelLeft className="size-4" />
      </Button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r bg-card px-4 pb-6 pt-16 shadow-xl transition-transform duration-200',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          SecureClaw Panel
        </p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeTab;
            return (
              <Button
                key={item.id}
                variant={active ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab(item.id);
                }}
              >
                <Icon className="mr-2 size-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      <main
        className={cn(
          'mx-auto max-w-5xl px-6 pb-20 pt-10 transition-[padding-left] duration-200',
          menuOpen ? 'pl-72' : 'pl-0'
        )}
      >
        <h1 className="mb-6 text-3xl font-semibold">{activeTabLabel}</h1>
        {renderContent()}
      </main>
    </div>
  );
}
