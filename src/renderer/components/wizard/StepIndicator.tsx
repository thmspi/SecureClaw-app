import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWizardStore, WizardStep } from '@/stores/wizard-store';
import { Check } from 'lucide-react';

interface Step {
  id: WizardStep;
  label: string;
  number: number;
}

const steps: Step[] = [
  { id: 'welcome', label: 'Welcome', number: 1 },
  { id: 'prerequisites', label: 'Prerequisites', number: 2 },
  { id: 'install', label: 'Install', number: 3 },
  { id: 'complete', label: 'Complete', number: 4 },
];

export function StepIndicator() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const completedSteps = useWizardStore((s) => s.completedSteps);
  const setStep = useWizardStore((s) => s.setStep);
  const canNavigateTo = useWizardStore((s) => s.canNavigateTo);

  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-4 p-4 border-b">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const canNav = canNavigateTo(step.id);

        return (
          <div key={step.id} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={cn(
                  'w-8 h-0.5 transition-colors',
                  index <= currentIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
            <button
              onClick={() => canNav && setStep(step.id)}
              disabled={!canNav}
              className={cn(
                'flex items-center gap-2 transition-all',
                canNav ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
              )}
            >
              <Badge
                variant={isCurrent ? 'default' : isCompleted ? 'secondary' : 'outline'}
                className={cn(
                  'size-8 flex items-center justify-center p-0 text-sm font-semibold',
                  isCurrent && 'ring-2 ring-primary/20'
                )}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="size-4" />
                ) : (
                  step.number
                )}
              </Badge>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:inline',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
