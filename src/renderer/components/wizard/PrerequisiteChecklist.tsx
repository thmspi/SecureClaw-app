import { cn } from '@/lib/utils';
import { PrerequisiteCheck } from '@/stores/wizard-store';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PrerequisiteChecklistProps {
  checks: PrerequisiteCheck[];
}

const statusIcons = {
  passed: CheckCircle2,
  failed: XCircle,
  warning: AlertCircle,
  pending: Loader2,
};

const statusColors = {
  passed: 'text-green-600',
  failed: 'text-destructive',
  warning: 'text-yellow-600',
  pending: 'text-muted-foreground',
};

export function PrerequisiteChecklist({ checks }: PrerequisiteChecklistProps) {
  if (checks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {checks.map((check) => {
        const Icon = statusIcons[check.status];
        const colorClass = statusColors[check.status];

        return (
          <div
            key={check.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
          >
            <Icon
              className={cn(
                'size-5 mt-0.5 shrink-0',
                colorClass,
                check.status === 'pending' && 'animate-spin'
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{check.name}</span>
                {check.result.value && (
                  <span className="text-xs text-muted-foreground">
                    {check.result.value}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {check.result.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
