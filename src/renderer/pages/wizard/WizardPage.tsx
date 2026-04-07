import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { StepIndicator } from '@/components/wizard/StepIndicator';
import { useWizardStore, WizardStep } from '@/stores/wizard-store';
import { WelcomeStep } from './WelcomeStep';
import { PrerequisitesStep } from './PrerequisitesStep';
import { InstallStep } from './InstallStep';
import { CompleteStep } from './CompleteStep';
import { ComponentType } from 'react';

const stepComponents: Record<WizardStep, ComponentType> = {
  welcome: WelcomeStep,
  prerequisites: PrerequisitesStep,
  install: InstallStep,
  complete: CompleteStep,
};

export function WizardPage() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const StepComponent = stepComponents[currentStep];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl overflow-hidden">
        <StepIndicator />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}
