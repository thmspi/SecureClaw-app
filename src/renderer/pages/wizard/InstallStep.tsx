import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InstallProgress } from '@/components/wizard/InstallProgress';
import { ErrorPanel } from '@/components/wizard/ErrorPanel';
import { useWizardStore } from '@/stores/wizard-store';
import { useInstallProgress } from '@/hooks/use-install-progress';
import { useState } from 'react';

export function InstallStep() {
  const selectedTarget = useWizardStore((s) => s.selectedTarget);
  const install = useWizardStore((s) => s.install);
  const setStep = useWizardStore((s) => s.setStep);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { start, cancel, retry } = useInstallProgress();

  const targetName = selectedTarget === 'openclaw' ? 'OpenClaw' : 'NemoClaw';

  const handleStartInstall = async () => {
    if (selectedTarget) {
      await start(selectedTarget);
    }
  };

  const handleCancel = async () => {
    await cancel();
    setCancelDialogOpen(false);
  };

  const handleRetry = async () => {
    await retry();
  };

  // Auto-advance to complete step when install finishes
  if (install.status === 'completed') {
    setStep('complete');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Installing {targetName}
        </h2>
        <p className="text-muted-foreground">
          {install.status === 'idle'
            ? 'Ready to install. Click the button below to begin.'
            : 'Please wait while we set up your installation.'}
        </p>
      </div>

      {install.status === 'idle' && (
        <div className="flex justify-center py-8">
          <Button size="lg" onClick={handleStartInstall} className="min-h-11">
            Install {targetName}
          </Button>
        </div>
      )}

      {(install.status === 'running' || install.status === 'paused') && (
        <>
          <InstallProgress
            progress={install.progress}
            stepName={install.stepName}
            currentStep={install.currentStep}
            totalSteps={install.totalSteps}
            estimatedTimeRemaining={install.estimatedTimeRemaining}
            logs={install.logs}
          />

          <div className="flex justify-end">
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Cancel Installation</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Installation?</DialogTitle>
                  <DialogDescription>
                    This will remove downloaded files and return to setup. Any progress
                    will be lost. Continue?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                    Keep Installing
                  </Button>
                  <Button variant="destructive" onClick={handleCancel}>
                    Cancel and Remove
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}

      {install.status === 'failed' && install.error && (
        <ErrorPanel
          message={install.error.message}
          details={install.error.details}
          onRetry={handleRetry}
          onCancel={() => setCancelDialogOpen(true)}
        />
      )}
    </div>
  );
}
