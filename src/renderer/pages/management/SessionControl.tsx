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
import { useManagementStore } from '@/stores/management-store';

export default function SessionControl() {
  const { activeSessions, sessionStarting, sessionStopping, startSession, stopSession } = useManagementStore();
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const activeSession = activeSessions[0];
  const hasActiveSession = Boolean(activeSession);

  const handleStartSession = async () => {
    const sessionId = crypto.randomUUID();
    const result = await startSession(sessionId);
    if (!result.started && result.error) {
      console.error('Failed to start session:', result.error);
    }
  };

  const handleStopClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowStopDialog(true);
  };

  const handleStopConfirm = async () => {
    if (selectedSessionId) {
      const result = await stopSession(selectedSessionId);
      if (!result.stopped && result.error) {
        console.error('Failed to stop session:', result.error);
      }
    }
    setShowStopDialog(false);
    setSelectedSessionId(null);
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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {getSessionStateBadge()}
          {hasActiveSession && activeSession?.activeAt ? (
            <p className="text-sm text-muted-foreground">
              Active since {new Date(activeSession.activeAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start a session to launch with your selected plugin packages
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
