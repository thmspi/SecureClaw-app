// Install contracts - single source of truth for install request/response/event shapes

export type PrerequisiteStatus = 'passed' | 'failed' | 'warning';

export interface PrerequisiteCheck {
  id: string;
  name: string;
  description: string;
  status: PrerequisiteStatus;
  result: {
    value?: string;
    required?: string;
    message: string;
    action?: 'start-docker-daemon';
  };
}

export interface PrerequisiteResult {
  allPassed: boolean;
  checks: PrerequisiteCheck[];
}

export interface StartDockerDaemonResult {
  started: boolean;
  ready: boolean;
  message: string;
}

export interface UninstallStackResult {
  removed: string[];
  errors?: string[];
}

export interface InstallProgress {
  correlationId: string;
  step: number;
  totalSteps: number;
  stepName: string;
  progress: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
}

export interface InstallError {
  correlationId: string;
  message: string;
  details?: string;
  step: number;
}

export type InstallStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'rolled_back';

export type InstallTarget = 'openclaw' | 'nemoclaw';

export interface InstallState {
  target: InstallTarget;
  status: InstallStatus;
  currentStep: number;
  totalSteps: number;
  stepName?: string;
  errorMessage?: string;
  errorDetails?: string;
  startedAt?: string;
  updatedAt: string;
  completedSteps: number[];
}
