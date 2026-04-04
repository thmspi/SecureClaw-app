import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import InlineSupportError, {
  classifyRuntimeStringError,
} from '@/components/management/InlineSupportError';
import type { SupportErrorEnvelope } from '../../../shared/diagnostics/diagnostics-contracts';
import { useManagementStore } from '@/stores/management-store';

export default function SessionControl() {
  const { activeSessions, sessionStarting, sessionStopping, startSession, stopSession } = useManagementStore();
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<SupportErrorEnvelope | null>(null);

  const activeSession = activeSessions[0];
  const hasActiveSession = Boolean(activeSession);

  const handleStartSession = async () => {
    const sessionId = crypto.randomUUID();
    const result = await startSession(sessionId);
    if (!result.started && result.error) {
      setSessionError(classifyRuntimeStringError(result.error, 'start a runtime session'));
      return;
    }
    setSessionError(null);
  };

  const handleStopClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowStopDialog(true);
  };

  const handleStopConfirm = async () => {
    if (selectedSessionId) {
      const result = await stopSession(selectedSessionId);
      if (!result.stopped && result.error) {
        setSessionError(classifyRuntimeStringError(result.error, 'stop the runtime session'));
      } else {
        setSessionError(null);
      }
    }
    setShowStopDialog(false);
    setSelectedSessionId(null);
  };

  const handleRetry = async () => {
    if (hasActiveSession && activeSession) {
      const result = await stopSession(activeSession.sessionId);
      if (!result.stopped && result.error) {
        setSessionError(classifyRuntimeStringError(result.error, 'stop the runtime session'));
        return;
      }
      setSessionError(null);
      return;
    }

    await handleStartSession();
  };

  const getSessionStateBadge = () => {
    if (sessionStarting) {
      return <Badge variant="secondary">Starting session...</Badge>;
    }

    if (sessionStopping) {
      return <Badge variant="secondary">Stopping session...</Badge>;
    }

    if (hasActiveSession) {
      return <Badge variant="default">Session active</Badge>;
    }

    return <Badge variant="outline">No active session</Badge>;
  };

  return (
    <div className="space-y-4">
      {sessionError && (
        <InlineSupportError
          title="Session Control Error"
          error={sessionError}
          onRetry={sessionError.retryable ? () => void handleRetry() : undefined}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {getSessionStateBadge()}
          {hasActiveSession && activeSession?.activeAt ? (
            <p className="text-sm text-muted-foreground">
              Active since {new Date(activeSession.activeAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start a session to bring the OpenClaw runtime online.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {!hasActiveSession ? (
            <Button onClick={handleStartSession} disabled={sessionStarting} variant="default" size="lg">
              {sessionStarting ? 'Starting...' : 'Start Session'}
            </Button>
          ) : (
            <Button
              onClick={() => handleStopClick(activeSession.sessionId)}
              disabled={sessionStopping}
              variant="destructive"
              size="lg"
            >
              {sessionStopping ? 'Stopping...' : 'Stop Session'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Session</DialogTitle>
            <DialogDescription>
              This will terminate the active session and any running plugins. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleStopConfirm}>
              Stop Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
