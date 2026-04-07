import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { AlertCircle, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorPanelProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function ErrorPanel({ message, details, onRetry, onCancel }: ErrorPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Alert variant="destructive" className="space-y-3">
      <AlertCircle className="size-4" />
      <AlertTitle>Installation Failed</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>

        {details && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-destructive hover:text-destructive"
              >
                What went wrong
                <ChevronDown
                  className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-lg bg-destructive/10 font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
                {details}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex gap-2 pt-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-4 mr-1" />
              Retry
            </Button>
          )}
          {onCancel && (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              <X className="size-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
