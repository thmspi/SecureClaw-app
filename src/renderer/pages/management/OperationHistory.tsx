import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useManagementStore } from '@/stores/management-store';
import type { RuntimeHistoryRecord } from '@/../shared/runtime/runtime-contracts';

export default function OperationHistory() {
  const { history, historyFilters, historyLoading, setHistoryFilters, applyHistoryFilters } = useManagementStore();
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const handleApplyFilters = () => {
    void applyHistoryFilters();
  };

  const getTypeBadge = (type: RuntimeHistoryRecord['operationType']) => {
    if (type === 'session_start') {
      return <Badge variant="secondary">Session Start</Badge>;
    }
    if (type === 'session_stop') {
      return <Badge variant="secondary">Session Stop</Badge>;
    }
    return <Badge variant="outline">Plugin Run</Badge>;
  };

  const getStatusBadge = (status: RuntimeHistoryRecord['status']) => {
    if (status === 'success') {
      return <Badge variant="default">Success</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Cancelled</Badge>;
  };

  if (history.length === 0 && !historyLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="font-medium">No operations recorded</p>
        <p className="text-sm">Session and plugin operations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Operation Type</label>
          <Select
            value={historyFilters.operationType ?? 'all'}
            onValueChange={(value) =>
              setHistoryFilters({
                operationType: value === 'all' ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="session_start">Session Start</SelectItem>
              <SelectItem value="session_stop">Session Stop</SelectItem>
              <SelectItem value="plugin_run">Plugin Run</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={historyFilters.status ?? 'all'}
            onValueChange={(value) =>
              setHistoryFilters({
                status: value === 'all' ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">From Date</label>
          <Input
            type="date"
            value={historyFilters.fromDate ?? ''}
            onChange={(event) =>
              setHistoryFilters({
                fromDate: event.target.value || undefined,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">To Date</label>
          <Input
            type="date"
            value={historyFilters.toDate ?? ''}
            onChange={(event) =>
              setHistoryFilters({
                toDate: event.target.value || undefined,
              })
            }
          />
        </div>

        <Button onClick={handleApplyFilters} disabled={historyLoading}>
          {historyLoading ? 'Loading...' : 'Apply Filters'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((record) => {
            const isExpanded = expandedRecordId === record.id;
            return (
              <Fragment key={record.id}>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        aria-label={isExpanded ? 'Collapse record details' : 'Expand record details'}
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                      {new Date(record.startedAt).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(record.operationType)}</TableCell>
                  <TableCell>{record.targetName || '-'}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>{record.durationMs ? `${(record.durationMs / 1000).toFixed(1)}s` : '-'}</TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Collapsible open={isExpanded}>
                        <CollapsibleContent forceMount>
                          <div className="space-y-2 rounded-md bg-muted p-4">
                            <div>
                              <strong className="text-sm">ID:</strong>{' '}
                              <span className="font-mono text-xs">{record.id}</span>
                            </div>
                            {record.errorMessage && (
                              <div className="text-destructive">
                                <strong className="text-sm">Error:</strong>{' '}
                                <span className="text-sm">{record.errorMessage}</span>
                              </div>
                            )}
                            {record.errorDetails && (
                              <pre className="max-h-40 overflow-auto text-xs">{record.errorDetails}</pre>
                            )}
                            {record.metadata && (
                              <div>
                                <strong className="text-sm">Metadata:</strong>
                                <pre className="mt-1 overflow-auto text-xs">
                                  {JSON.stringify(record.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
