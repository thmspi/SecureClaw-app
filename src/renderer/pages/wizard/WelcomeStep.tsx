import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/stores/wizard-store';
import { ArrowRight, Shield } from 'lucide-react';

export function WelcomeStep() {
  const setStep = useWizardStore((s) => s.setStep);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <Shield className="size-16 text-primary" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to SecureClaw
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let's get you set up. This wizard will guide you through prerequisites and
          install OpenClaw and NemoClaw on your system.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
        <h3 className="font-medium mb-2">What will be installed:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>OpenClaw</strong> — Personal AI assistant runtime and CLI</li>
          <li>• <strong>NemoClaw</strong> — NVIDIA secure sandbox stack for running OpenClaw</li>
        </ul>
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => setStep('prerequisites')}
          className="min-h-11"
        >
          Get Started
          <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
