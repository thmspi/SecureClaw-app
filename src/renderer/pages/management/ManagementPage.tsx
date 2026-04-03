import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useManagementStore } from '@/stores/management-store';
import SessionControl from './SessionControl';
import PluginRuns from './PluginRuns';
import OperationHistory from './OperationHistory';

export default function ManagementPage() {
  const { loadSessions, loadPluginRuns, loadHistory } = useManagementStore();

  useEffect(() => {
    void loadSessions();
    void loadPluginRuns();
    void loadHistory();
  }, [loadSessions, loadPluginRuns, loadHistory]);

  useEffect(() => {
    const unsubscribeSession = window.secureClaw.runtime.onSessionEvent((event) => {
      useManagementStore.getState().handleSessionEvent(event);
    });

    const unsubscribePlugin = window.secureClaw.runtime.onPluginEvent((event) => {
      useManagementStore.getState().handlePluginEvent(event);
    });

    return () => {
      unsubscribeSession();
      unsubscribePlugin();
    };
  }, []);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-semibold">Session Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Session Control</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionControl />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Plugin Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <PluginRuns />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Operation History</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationHistory />
        </CardContent>
      </Card>
    </div>
  );
}
