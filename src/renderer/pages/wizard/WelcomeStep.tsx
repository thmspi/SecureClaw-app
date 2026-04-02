import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useWizardStore } from '@/stores/wizard-store';
import { ArrowRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WelcomeStep() {
  const selectedTarget = useWizardStore((s) => s.selectedTarget);
  const setSelectedTarget = useWizardStore((s) => s.setSelectedTarget);
  const setStep = useWizardStore((s) => s.setStep);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to SecureClaw
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let's get you set up. This wizard will guide you through prerequisites and
          installation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl mx-auto">
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50',
            selectedTarget === 'openclaw' && 'border-primary ring-2 ring-primary/20'
          )}
          onClick={() => setSelectedTarget('openclaw')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              <span className="font-semibold">OpenClaw</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Open-source clipboard security with full transparency
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50',
            selectedTarget === 'nemoclaw' && 'border-primary ring-2 ring-primary/20'
          )}
          onClick={() => setSelectedTarget('nemoclaw')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              <span className="font-semibold">NemoClaw</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enhanced security features with cloud sync
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => setStep('prerequisites')}
          disabled={!selectedTarget}
          className="min-h-11"
        >
          Get Started
          <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
