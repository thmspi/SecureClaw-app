import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useManagementStore } from '@/stores/management-store';
import type { PluginRun } from '@/../shared/runtime/runtime-contracts';

export default function PluginRuns() {
  const { activeSessions, pluginRuns, runPlugin, cancelPluginRun } = useManagementStore();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const hasActiveSession = activeSessions.length > 0;
  const activeSession = activeSessions[0];

  const handleRunPlugin = async (pluginName: string) => {
    if (!activeSession) {
      return;
    }

    const runId = crypto.randomUUID();
    const result = await runPlugin(runId, pluginName, activeSession.sessionId);
    if (!result.queued && result.error) {
      console.error('Failed to run plugin:', result.error);
    }
  };

  const handleRetry = async (run: PluginRun) => {
    const runId = crypto.randomUUID();
    const result = await runPlugin(runId, run.pluginName, run.sessionId);
    if (!result.queued && result.error) {
      console.error('Failed to retry plugin:', result.error);
    }
  };

  const handleCancel = async (runId: string) => {
    const result = await cancelPluginRun(runId);
    if (!result.cancelled && result.error) {
      console.error('Failed to cancel plugin run:', result.error);
    }
  };

  const getStateBadge = (state: PluginRun['state']) => {
    if (state === 'Queued' || state === 'Starting') {
      return <Badge variant="secondary">{state}</Badge>;
    }
    if (state === 'Running' || state === 'Completed') {
      return <Badge variant="default">{state}</Badge>;
    }
    if (state === 'Failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="outline">{state}</Badge>;
  };

  if (pluginRuns.length === 0) {
    return (
      <div className="space-y-4">
        {!hasActiveSession && <p className="text-sm text-muted-foreground">Start a session to run plugins</p>}
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-medium">No plugin runs yet</p>
          <p className="text-sm">Start a session, then run a plugin to see execution here.</p>
        </div>
        <div className="border-t pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={() => handleRunPlugin('example-plugin')} disabled={!hasActiveSession} size="sm">
                    Run
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasActiveSession && (
                <TooltipContent>
                  <p>Start a session to run plugins</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasActiveSession && <p className="text-sm text-muted-foreground">Start a session to run plugins</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plugin Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pluginRuns.map((run) => {
            const isExpanded = expandedRunId === run.runId;
            return (
              <Fragment key={run.runId}>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedRunId(isExpanded ? null : run.runId)}
                        aria-label={isExpanded ? 'Collapse run details' : 'Expand run details'}
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                      {run.pluginName}
                    </div>
                  </TableCell>
                  <TableCell>{getStateBadge(run.state)}</TableCell>
                  <TableCell>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {run.state === 'Failed' && (
                        <Button variant="outline" size="sm" onClick={() => handleRetry(run)}>
                          Retry
                        </Button>
                      )}

                      {(run.state === 'Starting' || run.state === 'Running') && (
                        <Button variant="outline" size="sm" onClick={() => handleCancel(run.runId)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="rounded-md bg-muted p-4">
                        <p className="mb-2 text-sm font-medium">Logs</p>
                        <pre className="max-h-40 overflow-auto text-xs">{run.logs.length ? run.logs.join('\n') : 'No logs available'}</pre>
                        {run.error && (
                          <p className="mt-2 text-sm text-destructive">
                            <strong>Error:</strong> {run.error}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <div className="border-t pt-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button onClick={() => handleRunPlugin('example-plugin')} disabled={!hasActiveSession} size="sm">
                  Run
                </Button>
              </span>
            </TooltipTrigger>
            {!hasActiveSession && (
              <TooltipContent>
                <p>Start a session to run plugins</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
