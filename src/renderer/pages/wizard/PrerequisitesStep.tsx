import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrerequisiteChecklist } from '@/components/wizard/PrerequisiteChecklist';
import { useWizardStore } from '@/stores/wizard-store';
import { usePrerequisites } from '@/hooks/use-prerequisites';
import { ArrowRight, RefreshCw } from 'lucide-react';

export function PrerequisitesStep() {
  const prerequisites = useWizardStore((s) => s.prerequisites);
  const prerequisitesLoading = useWizardStore((s) => s.prerequisitesLoading);
  const allPrerequisitesPassed = useWizardStore((s) => s.allPrerequisitesPassed);
  const setStep = useWizardStore((s) => s.setStep);
  const { runChecks, startDockerDaemon } = usePrerequisites();
  const [startingDocker, setStartingDocker] = useState(false);
  const [dockerActionError, setDockerActionError] = useState<string | null>(null);
  const [dockerActionInfo, setDockerActionInfo] = useState<string | null>(null);

  const checks = Object.values(prerequisites);

  // Run prerequisite checks on mount
  useEffect(() => {
    if (checks.length === 0) {
      runChecks();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecheck = () => {
    runChecks();
  };

  const handleStartDockerDaemon = async () => {
    setDockerActionError(null);
    setDockerActionInfo(null);
    setStartingDocker(true);
    try {
      const result = await startDockerDaemon();
      setDockerActionInfo(result.message);
      await runChecks();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDockerActionError(message);
    } finally {
      setStartingDocker(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Checking Prerequisites
        </h2>
        <p className="text-muted-foreground">
          Verifying your system meets the requirements for installation.
        </p>
      </div>

      {prerequisitesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="size-5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PrerequisiteChecklist
          checks={checks}
          onStartDockerDaemon={handleStartDockerDaemon}
          dockerStartPending={startingDocker}
        />
      )}

      {dockerActionError && (
        <p className="text-xs text-destructive">{dockerActionError}</p>
      )}
      {dockerActionInfo && !dockerActionError && (
        <p className="text-xs text-muted-foreground">{dockerActionInfo}</p>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handleRecheck} disabled={prerequisitesLoading}>
          <RefreshCw className="size-4 mr-1" />
          Re-check
        </Button>

        <Button
          onClick={() => setStep('install')}
          disabled={!allPrerequisitesPassed || prerequisitesLoading}
        >
          Continue
          <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
