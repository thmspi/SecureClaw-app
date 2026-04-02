import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface InstallProgressProps {
  progress: number;
  stepName: string;
  currentStep: number;
  totalSteps: number;
  estimatedTimeRemaining?: number;
  logs: string[];
}

export function InstallProgress({
  progress,
  stepName,
  currentStep,
  totalSteps,
  estimatedTimeRemaining,
  logs,
}: InstallProgressProps) {
  const [showDetails, setShowDetails] = useState(false);
  const completedSteps = Math.max(0, Math.min(totalSteps, currentStep - 1));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `About ${mins}m ${secs}s remaining`;
    }
    return `About ${secs}s remaining`;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {stepName}... Step {currentStep} of {totalSteps}
          </span>
          <span className="text-muted-foreground">
            {completedSteps}/{totalSteps} completed
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatTime(estimatedTimeRemaining)}
          </p>
        )}
      </div>

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            Show details
            <ChevronDown
              className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 p-3 rounded-lg bg-muted font-mono text-xs max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">No output yet...</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
