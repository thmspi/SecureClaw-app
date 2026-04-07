import { useState } from 'react';
import { AlertCircle, ChevronDown, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { SupportErrorEnvelope } from '../../../shared/diagnostics/diagnostics-contracts';

const RETRYABLE_RUNTIME_PATTERN = /(timeout|timed out|temporar|EAI_AGAIN|ECONNRESET)/i;
const NON_RETRYABLE_RUNTIME_PATTERN = /(ENOENT|not found|EACCES|permission|unsupported)/i;

export function classifyRuntimeStringError(
  message: string,
  operation: string
): SupportErrorEnvelope {
  const retryable = RETRYABLE_RUNTIME_PATTERN.test(message)
    ? true
    : NON_RETRYABLE_RUNTIME_PATTERN.test(message)
      ? false
      : true;

  return {
    userMessage: `SecureClaw could not ${operation}.`,
    nextSteps: retryable
      ? [
          'Retry this action once from the same section.',
          'Check your network and runtime processes, then retry.',
          'If this keeps failing, export diagnostics from Settings > Health and share with IT.',
        ]
      : [
          'Review local runtime prerequisites and permissions on this machine.',
          'Fix the missing file/access issue before retrying.',
          'Export diagnostics from Settings > Health and share with IT support.',
        ],
    retryable,
    errorCode: retryable ? 'RUNTIME_OPERATION_RETRYABLE' : 'RUNTIME_OPERATION_NON_RETRYABLE',
    technicalDetails: message,
  };
}

interface InlineSupportErrorProps {
  title: string;
  error: SupportErrorEnvelope;
  onRetry?: () => void;
}

export default function InlineSupportError({
  title,
  error,
  onRetry,
}: InlineSupportErrorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <Alert variant="destructive" className="space-y-3">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.userMessage}</p>

        {error.nextSteps.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5">
            {error.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}

        {error.technicalDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-destructive hover:text-destructive"
              >
                Technical details
                <ChevronDown className={`size-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-32 overflow-y-auto rounded-lg bg-destructive/10 p-3 font-mono text-xs whitespace-pre-wrap">
                {error.technicalDetails}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {error.retryable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="mr-1 size-4" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
