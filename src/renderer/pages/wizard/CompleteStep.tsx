import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/stores/wizard-store';
import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';

export function CompleteStep() {
  const selectedTarget = useWizardStore((s) => s.selectedTarget);
  const reset = useWizardStore((s) => s.reset);

  const targetName = selectedTarget === 'openclaw' ? 'OpenClaw' : 'NemoClaw';
  const openDashboard = () => {
    window.history.pushState({}, '', '/management');
    window.dispatchEvent(new Event('secureclaw:navigate'));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col items-center text-center space-y-4 py-8">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Setup Complete</h2>
          <p className="text-muted-foreground max-w-md">
            {targetName} has been installed successfully. You're ready to start using
            SecureClaw.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" className="min-h-11" onClick={openDashboard}>
          Open Dashboard
          <ExternalLink className="size-4 ml-1" />
        </Button>
        <Button variant="ghost" size="lg" onClick={reset} className="min-h-11">
          <RotateCcw className="size-4 mr-1" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
