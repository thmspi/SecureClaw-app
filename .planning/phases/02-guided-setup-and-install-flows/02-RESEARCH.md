# Phase 2: Guided Setup and Install Flows - Research

**Researched:** 2026-04-01
**Domain:** Setup wizard UX, prerequisite checking, install orchestration, crash recovery
**Confidence:** HIGH

## Summary

This phase delivers a guided setup wizard that enables low-technical users to install OpenClaw and NemoClaw without terminal commands. The implementation leverages Phase 1's centralized platform layer (process runner, path service, IPC contracts) and extends it with install-specific orchestration, prerequisite checking, and crash-resilient state persistence.

The core technical challenges are: (1) wizard state management with step transitions and persistence, (2) prerequisite detection across macOS with graceful failure messaging, (3) streaming install progress from main process to renderer via IPC events, and (4) transactional install steps with rollback capability.

**Primary recommendation:** Use zustand for wizard state with localStorage persistence for renderer, better-sqlite3 for install state persistence in main process (crash recovery), and framer-motion for step transition animations. Extend the existing IPC pattern with install-specific channels for streaming progress events.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Wizard opens with a friendly welcome screen showing setup overview before first step.
- **D-02:** Step indicator bar at top (1 > 2 > 3 > 4) with clickable navigation allowing back-jumps to completed steps.
- **D-03:** Animated transitions between wizard steps for polished feel.
- **D-04:** Blocking step model — user must complete current step before advancing.
- **D-05:** Full prerequisite coverage: environment (Node.js version, Python, shell access), permissions (disk write, network), and disk space.
- **D-06:** Hard block with remediation — install button disabled until all checks pass, with clear fix instructions per failure.
- **D-07:** Checklist display with green/red icons per item plus overall status for quick visual scan.
- **D-08:** Automatic checks on wizard step entry with manual "Re-check" button.
- **D-09:** Named steps with overall progress bar (e.g., "Downloading OpenClaw... Step 2 of 5").
- **D-10:** Raw log output hidden by default, expandable "Show details" panel for power users.
- **D-11:** Inline error display with plain-language explanation and expandable "What went wrong" technical details.
- **D-12:** Show estimated time remaining when determinable.
- **D-13:** Retry resumes from failed step — completed steps are skipped to save time.
- **D-14:** Cancel shows confirmation dialog summarizing what will be removed before cleanup.
- **D-15:** Full rollback to pre-install state on cancel or failure for clean recovery.
- **D-16:** Install state tracked in local DB — survives app restart for crash recovery.

### Agent's Discretion
- Specific animation timing and easing for step transitions.
- Exact prerequisite check order and grouping.
- Progress bar visual style and color scheme.
- Technical details format in expandable error panels.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | User can complete a guided first-run setup wizard without using terminal commands | Wizard state management with zustand, step transitions with framer-motion, all operations via IPC |
| SETUP-02 | App performs prerequisite checks (environment, permissions, required dependencies) before installation | Prerequisite check service in main process, typed results via IPC, checklist UI components |
| SETUP-03 | User can run one-click install flow for OpenClaw and NemoClaw | Install orchestrator with step-based execution, IPC streaming progress, uses Phase 1 process runner |
| SETUP-04 | Install flow displays step-by-step progress and current state | Progress streaming via IPC events, zustand state updates, Progress + Collapsible components |
| SETUP-05 | Install flow supports retry/cancel/rollback with safe recovery behavior | Transactional steps with artifact tracking, better-sqlite3 persistence, rollback service |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.12 | Wizard UI state management | Lightweight, TypeScript-native, built-in persist middleware for localStorage |
| framer-motion | 12.38.0 | Step transition animations | Best-in-class React animation, AnimatePresence for enter/exit transitions |
| better-sqlite3 | 12.8.0 | Install state persistence (main process) | Already in STACK.md, synchronous API ideal for crash recovery checkpoints |

### Supporting (from UI-SPEC)

| Component | Source | Purpose | When to Use |
|-----------|--------|---------|-------------|
| Card | shadcn | Wizard container panels | Wrap each wizard step content |
| Button | shadcn | Actions, navigation | Primary CTA, step navigation |
| Progress | shadcn | Install progress bar | Overall and step-level progress display |
| Badge | shadcn | Step numbers in indicator | Step 1, 2, 3, 4 badges in navigation |
| Alert | shadcn | Status messages | Success, warning, error states |
| Checkbox | shadcn | Checklist display (read-only) | Prerequisite check results |
| Collapsible | shadcn | Expandable log panel | "Show details" for install logs |
| Skeleton | shadcn | Loading states | During prerequisite checks |
| Dialog | shadcn | Confirmation dialogs | Cancel/rollback confirmation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand | XState | XState provides formal state machines but adds complexity; zustand simpler for wizard flow |
| framer-motion | CSS transitions | CSS simpler but lacks AnimatePresence for exit animations (D-03 requires polished feel) |
| better-sqlite3 | localStorage | localStorage doesn't survive app reinstall; SQLite is more robust for crash recovery |

**Installation:**
```bash
npm install zustand framer-motion better-sqlite3
npm install -D @types/better-sqlite3
```

**shadcn Components:**
```bash
npx shadcn@latest add card button progress badge alert checkbox collapsible skeleton dialog
```

**Version verification:** Verified against npm registry 2026-04-01.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── install/
│   │   ├── install-orchestrator.ts     # Step execution engine
│   │   ├── install-state-service.ts    # SQLite persistence (D-16)
│   │   ├── prerequisite-service.ts     # Check runners
│   │   └── rollback-service.ts         # Artifact tracking + cleanup
│   ├── ipc/
│   │   └── install-router.ts           # IPC handlers for install operations
│   └── db/
│       └── schema/
│           └── install-state.sql       # Install state table
├── preload/
│   └── install-api.ts                  # Install IPC bridge
├── renderer/
│   ├── pages/
│   │   └── wizard/
│   │       ├── WizardPage.tsx          # Main wizard container
│   │       ├── WelcomeStep.tsx         # D-01
│   │       ├── PrerequisitesStep.tsx   # D-05 through D-08
│   │       ├── InstallStep.tsx         # D-09 through D-12
│   │       └── CompleteStep.tsx        # Success state
│   ├── components/
│   │   ├── wizard/
│   │   │   ├── StepIndicator.tsx       # D-02 navigation bar
│   │   │   ├── PrerequisiteChecklist.tsx # D-07 checklist
│   │   │   ├── InstallProgress.tsx     # D-09 progress display
│   │   │   └── ErrorPanel.tsx          # D-11 error display
│   │   └── ui/                         # shadcn components
│   ├── stores/
│   │   └── wizard-store.ts             # zustand store
│   └── hooks/
│       ├── use-install-progress.ts     # IPC event subscription
│       └── use-prerequisites.ts        # Prereq check trigger
└── shared/
    └── install/
        ├── install-contracts.ts        # Typed request/response shapes
        └── install-channels.ts         # IPC channel constants + zod schemas
```

### Pattern 1: Wizard State Machine with zustand

**What:** Single zustand store manages wizard step, prerequisites, and install state with localStorage persistence.

**When to use:** All wizard UI state management.

**Example:**
```typescript
// src/renderer/stores/wizard-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type WizardStep = 'welcome' | 'prerequisites' | 'install' | 'complete';

interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  prerequisites: Record<string, PrerequisiteCheck>;
  install: {
    status: 'idle' | 'running' | 'paused' | 'failed' | 'completed';
    currentStep: number;
    totalSteps: number;
    stepName: string;
    progress: number;
    error?: { message: string; details?: string };
    logs: string[];
  };
  // Actions
  setStep: (step: WizardStep) => void;
  canNavigateTo: (step: WizardStep) => boolean;
  updatePrerequisite: (id: string, check: PrerequisiteCheck) => void;
  updateInstallProgress: (progress: Partial<WizardState['install']>) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 'welcome',
      completedSteps: [],
      prerequisites: {},
      install: {
        status: 'idle',
        currentStep: 0,
        totalSteps: 5,
        stepName: '',
        progress: 0,
        logs: [],
      },
      setStep: (step) => {
        const { currentStep, completedSteps } = get();
        set({
          currentStep: step,
          completedSteps: completedSteps.includes(currentStep)
            ? completedSteps
            : [...completedSteps, currentStep],
        });
      },
      canNavigateTo: (step) => {
        const { completedSteps, currentStep } = get();
        return step === currentStep || completedSteps.includes(step);
      },
      updatePrerequisite: (id, check) =>
        set((s) => ({
          prerequisites: { ...s.prerequisites, [id]: check },
        })),
      updateInstallProgress: (progress) =>
        set((s) => ({
          install: { ...s.install, ...progress },
        })),
      reset: () =>
        set({
          currentStep: 'welcome',
          completedSteps: [],
          prerequisites: {},
          install: { status: 'idle', currentStep: 0, totalSteps: 5, stepName: '', progress: 0, logs: [] },
        }),
    }),
    {
      name: 'secureclaw-wizard',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        prerequisites: state.prerequisites,
        install: { status: state.install.status, currentStep: state.install.currentStep },
      }),
    }
  )
);
```

### Pattern 2: IPC Event Streaming for Install Progress

**What:** Main process streams install events to renderer via `webContents.send()`, renderer subscribes via preload bridge.

**When to use:** Real-time install progress updates (D-09, D-12).

**Example:**
```typescript
// src/shared/install/install-channels.ts
import { z } from 'zod';

export const INSTALL_CHANNELS = {
  start: 'install:v1:start',
  cancel: 'install:v1:cancel',
  retry: 'install:v1:retry',
  getState: 'install:v1:getState',
  // Events (main → renderer)
  progress: 'install:v1:progress',
  stepChange: 'install:v1:stepChange',
  error: 'install:v1:error',
  complete: 'install:v1:complete',
} as const;

export const installProgressSchema = z.object({
  correlationId: z.string(),
  step: z.number(),
  totalSteps: z.number(),
  stepName: z.string(),
  progress: z.number().min(0).max(100),
  overallProgress: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number().optional(),
});

// src/preload/install-api.ts
const installAPI = {
  start: (target: 'openclaw' | 'nemoclaw'): Promise<{ correlationId: string }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.start, { target }),
  cancel: (correlationId: string): Promise<{ removed: string[] }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.cancel, { correlationId }),
  retry: (correlationId: string): Promise<void> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.retry, { correlationId }),
  
  // Event subscriptions - returns unsubscribe function
  onProgress: (callback: (progress: InstallProgress) => void) => {
    const handler = (_: unknown, data: InstallProgress) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.progress, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.progress, handler);
  },
  onError: (callback: (error: InstallError) => void) => {
    const handler = (_: unknown, data: InstallError) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.error, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.error, handler);
  },
  onComplete: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(INSTALL_CHANNELS.complete, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.complete, handler);
  },
};

// src/renderer/hooks/use-install-progress.ts
export function useInstallProgress() {
  const updateProgress = useWizardStore((s) => s.updateInstallProgress);
  
  useEffect(() => {
    const unsubProgress = window.secureClaw.install.onProgress((progress) => {
      updateProgress({
        currentStep: progress.step,
        totalSteps: progress.totalSteps,
        stepName: progress.stepName,
        progress: progress.overallProgress,
      });
    });
    
    const unsubError = window.secureClaw.install.onError((error) => {
      updateProgress({
        status: 'failed',
        error: { message: error.message, details: error.details },
      });
    });
    
    const unsubComplete = window.secureClaw.install.onComplete(() => {
      updateProgress({ status: 'completed', progress: 100 });
    });
    
    return () => { unsubProgress(); unsubError(); unsubComplete(); };
  }, [updateProgress]);
}
```

### Pattern 3: Step Transitions with AnimatePresence

**What:** Framer Motion's AnimatePresence handles enter/exit animations for wizard steps (D-03).

**When to use:** Wizard step content transitions.

**Example:**
```typescript
// src/renderer/pages/wizard/WizardPage.tsx
import { AnimatePresence, motion } from 'framer-motion';

const stepComponents: Record<WizardStep, React.ComponentType> = {
  welcome: WelcomeStep,
  prerequisites: PrerequisitesStep,
  install: InstallStep,
  complete: CompleteStep,
};

export function WizardPage() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const StepComponent = stepComponents[currentStep];
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
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
  );
}
```

### Pattern 4: Transactional Install Steps with Rollback

**What:** Each install step tracks artifacts created; rollback removes them in reverse order (D-13, D-14, D-15).

**When to use:** Install orchestration for safe recovery.

**Example:**
```typescript
// src/main/install/rollback-service.ts
interface InstallArtifact {
  type: 'file' | 'directory' | 'symlink';
  path: string;
  createdAt: string;
}

export class RollbackService {
  private artifacts: InstallArtifact[] = [];
  
  track(artifact: InstallArtifact): void {
    this.artifacts.push(artifact);
  }
  
  async rollback(): Promise<string[]> {
    const removed: string[] = [];
    // Reverse order: undo newest first
    for (const artifact of [...this.artifacts].reverse()) {
      try {
        if (artifact.type === 'directory') {
          await fs.rm(artifact.path, { recursive: true, force: true });
        } else {
          await fs.unlink(artifact.path);
        }
        removed.push(artifact.path);
      } catch (e) {
        // Log but continue - best effort cleanup
      }
    }
    this.artifacts = [];
    return removed;
  }
  
  getSummary(): string[] {
    return this.artifacts.map((a) => a.path);
  }
}
```

### Anti-Patterns to Avoid

- **IPC in renderer without preload bridge:** Never import `ipcRenderer` directly in renderer. Always use contextBridge-exposed API.
- **Blocking main process during long operations:** Use async steps with progress events, not synchronous loops.
- **Manual DOM animations:** Use framer-motion, not imperative DOM manipulation.
- **localStorage-only persistence for critical state:** D-16 requires survive-restart persistence; use SQLite for install state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom file-based state | zustand persist middleware + SQLite | Battle-tested, handles serialization edge cases |
| Semver comparison | Regex-based version parsing | `semver` npm package | Handles prerelease, build metadata correctly |
| Step animations | Manual CSS transitions | framer-motion AnimatePresence | Handles exit animations, layout animations |
| Disk space detection | Shell command parsing | `fs.statfsSync()` | Cross-platform, no subprocess overhead |
| Process version detection | Manual stdout parsing | Structured subprocess + regex | Phase 1 process runner already handles this |

**Key insight:** Wizard UX patterns are well-solved; focus implementation effort on the install orchestration and IPC integration, not reinventing state management.

## Common Pitfalls

### Pitfall 1: Race Conditions in IPC Event Handlers

**What goes wrong:** Multiple rapid progress events arrive before state updates complete, causing stale closure reads.
**Why it happens:** Zustand selectors capture state at subscription time.
**How to avoid:** Use `set()` with updater function, not `get()` + `set()`. Subscribe to specific slices, not whole store.
**Warning signs:** Progress bar jumping backwards, missed step transitions.

### Pitfall 2: Memory Leaks from IPC Listeners

**What goes wrong:** Event listeners accumulate on component remount.
**Why it happens:** Missing cleanup in useEffect return.
**How to avoid:** Always return unsubscribe function from useEffect. Store unsubscribe refs.
**Warning signs:** Console warnings about listeners, increasing memory usage.

### Pitfall 3: Orphaned Install State After Crash

**What goes wrong:** App crashes mid-install, restart shows inconsistent state.
**Why it happens:** In-memory state lost, but partially completed install artifacts remain.
**How to avoid:** D-16 requires SQLite persistence. Save state after each step completion. On startup, check for interrupted installs.
**Warning signs:** "Install" button active but directories already exist.

### Pitfall 4: Python Detection Failures on macOS

**What goes wrong:** `python` command fails, only `python3` works on modern macOS.
**Why it happens:** macOS doesn't ship `python` symlink by default.
**How to avoid:** Try `python3` first, fall back to `python`. Parse `--version` output.
**Warning signs:** Prerequisites fail when Python is clearly installed.

### Pitfall 5: Blocking Animations During Install

**What goes wrong:** UI feels frozen during install because animation library blocks.
**Why it happens:** Synchronous state updates during animation frames.
**How to avoid:** Use framer-motion's async-friendly patterns. Don't batch large state updates.
**Warning signs:** Janky progress bar, dropped animation frames.

## Code Examples

### Prerequisite Check Service

```typescript
// src/main/install/prerequisite-service.ts
import { spawn } from 'child_process';
import { statfsSync } from 'fs';
import { mkdirSync, rmdirSync } from 'fs';
import { app, net } from 'electron';
import { join } from 'path';
import type { PrerequisiteCheck, PrerequisiteResult } from '../../shared/install/prereq-types';

async function collectOutput(proc: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    proc.stdout?.on('data', (chunk) => { output += chunk.toString(); });
    proc.stderr?.on('data', (chunk) => { output += chunk.toString(); });
    proc.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(`Exit ${code}`)));
    proc.on('error', reject);
  });
}

function semverGte(a: string, b: string): boolean {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch >= bPatch;
}

async function checkNodeVersion(): Promise<PrerequisiteCheck> {
  const minVersion = '18.0.0';
  try {
    const proc = spawn('node', ['--version']);
    const output = await collectOutput(proc);
    const version = output.trim().replace(/^v/, '');
    const passed = semverGte(version, minVersion);
    return {
      id: 'node-version',
      name: 'Node.js',
      description: 'Node.js runtime for OpenClaw/NemoClaw',
      status: passed ? 'passed' : 'failed',
      result: { value: version, required: `>= ${minVersion}`, message: passed ? 'Installed' : `Requires ${minVersion}+` },
    };
  } catch {
    return {
      id: 'node-version',
      name: 'Node.js',
      description: 'Node.js runtime',
      status: 'failed',
      result: { required: `>= ${minVersion}`, message: 'Not found. Install from nodejs.org' },
    };
  }
}

async function checkPython(): Promise<PrerequisiteCheck> {
  const minVersion = '3.10.0';
  for (const cmd of ['python3', 'python']) {
    try {
      const proc = spawn(cmd, ['--version']);
      const output = await collectOutput(proc);
      const match = output.match(/Python (\d+\.\d+\.\d+)/);
      if (match) {
        const passed = semverGte(match[1], minVersion);
        return {
          id: 'python',
          name: 'Python',
          description: 'Python runtime for NemoClaw',
          status: passed ? 'passed' : 'failed',
          result: { value: match[1], required: `>= ${minVersion}`, message: passed ? 'Installed' : `Requires ${minVersion}+` },
        };
      }
    } catch { continue; }
  }
  return {
    id: 'python',
    name: 'Python',
    description: 'Python runtime',
    status: 'failed',
    result: { required: `>= ${minVersion}`, message: 'Not found. Install from python.org' },
  };
}

function checkDiskSpace(): PrerequisiteCheck {
  const minGb = 5;
  try {
    const stats = statfsSync(app.getPath('userData'));
    const freeGb = (stats.bfree * stats.bsize) / (1024 ** 3);
    const passed = freeGb >= minGb;
    return {
      id: 'disk-space',
      name: 'Disk Space',
      description: 'Available storage',
      status: passed ? 'passed' : 'failed',
      result: { value: `${freeGb.toFixed(1)} GB`, required: `>= ${minGb} GB`, message: passed ? 'Sufficient' : 'Insufficient space' },
    };
  } catch {
    return { id: 'disk-space', name: 'Disk Space', description: 'Storage check', status: 'warning', result: { message: 'Could not verify' } };
  }
}

function checkWritePermissions(): PrerequisiteCheck {
  const testDir = join(app.getPath('userData'), '.perm-test');
  try {
    mkdirSync(testDir, { recursive: true });
    rmdirSync(testDir);
    return { id: 'permissions', name: 'Write Permissions', description: 'Can write to app data', status: 'passed', result: { message: 'Confirmed' } };
  } catch {
    return { id: 'permissions', name: 'Write Permissions', description: 'Write access', status: 'failed', result: { message: 'Cannot write to app folder' } };
  }
}

async function checkNetwork(): Promise<PrerequisiteCheck> {
  const online = net.isOnline();
  return {
    id: 'network',
    name: 'Internet',
    description: 'Required for download',
    status: online ? 'passed' : 'warning',
    result: { message: online ? 'Connected' : 'No connection detected' },
  };
}

export async function runAllPrerequisiteChecks(): Promise<PrerequisiteResult> {
  const checks = await Promise.all([
    checkNodeVersion(),
    checkPython(),
    Promise.resolve(checkDiskSpace()),
    Promise.resolve(checkWritePermissions()),
    checkNetwork(),
  ]);
  const allPassed = checks.every((c) => c.status === 'passed' || c.status === 'warning');
  return { allPassed, checks };
}
```

### Install State Persistence (D-16)

```typescript
// src/main/install/install-state-service.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';

const DB_PATH = join(app.getPath('userData'), 'secureclaw.db');

interface InstallState {
  target: 'openclaw' | 'nemoclaw';
  status: 'pending' | 'running' | 'paused' | 'failed' | 'completed' | 'rolled_back';
  currentStep: number;
  totalSteps: number;
  stepName?: string;
  errorMessage?: string;
  errorDetails?: string;
  startedAt?: string;
  updatedAt: string;
  completedSteps: number[];
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS install_state (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        total_steps INTEGER NOT NULL DEFAULT 5,
        step_name TEXT,
        error_message TEXT,
        error_details TEXT,
        started_at TEXT,
        updated_at TEXT NOT NULL,
        completed_steps TEXT DEFAULT '[]'
      )
    `);
  }
  return db;
}

export function saveInstallState(state: InstallState): void {
  const stmt = getDb().prepare(`
    INSERT INTO install_state (id, target, status, current_step, total_steps, step_name, error_message, error_details, started_at, updated_at, completed_steps)
    VALUES ('singleton', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      target = excluded.target,
      status = excluded.status,
      current_step = excluded.current_step,
      step_name = excluded.step_name,
      error_message = excluded.error_message,
      error_details = excluded.error_details,
      updated_at = excluded.updated_at,
      completed_steps = excluded.completed_steps
  `);
  stmt.run(
    state.target,
    state.status,
    state.currentStep,
    state.totalSteps,
    state.stepName ?? null,
    state.errorMessage ?? null,
    state.errorDetails ?? null,
    state.startedAt ?? null,
    state.updatedAt,
    JSON.stringify(state.completedSteps)
  );
}

export function loadInstallState(): InstallState | null {
  const row = getDb().prepare('SELECT * FROM install_state WHERE id = ?').get('singleton') as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    target: row.target as InstallState['target'],
    status: row.status as InstallState['status'],
    currentStep: row.current_step as number,
    totalSteps: row.total_steps as number,
    stepName: row.step_name as string | undefined,
    errorMessage: row.error_message as string | undefined,
    errorDetails: row.error_details as string | undefined,
    startedAt: row.started_at as string | undefined,
    updatedAt: row.updated_at as string,
    completedSteps: JSON.parse((row.completed_steps as string) || '[]'),
  };
}

export function clearInstallState(): void {
  getDb().prepare('DELETE FROM install_state WHERE id = ?').run('singleton');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Class-based React state | Hooks + zustand | React 16.8+ (2019) | Simpler, no HOC wrappers |
| Redux for local state | zustand / jotai | 2021+ | Less boilerplate, built-in persistence |
| CSS keyframes | framer-motion | 2020+ | Declarative, exit animations, layout |
| `child_process.exec` | `spawn` with streams | Always preferred | Real-time output, no shell injection |

**Deprecated/outdated:**
- **keytar for secrets:** Use Electron `safeStorage` (first-party).
- **`nodeIntegration: true`:** Security risk; always use preload bridge.

## Open Questions

1. **OpenClaw/NemoClaw download URLs**
   - What we know: Installation requires downloading from upstream repos.
   - What's unclear: Exact download URLs, archive format, verification checksums.
   - Recommendation: Define in config file; planner should treat as placeholder URLs for now.

2. **Minimum version requirements**
   - What we know: Node.js 18+, Python 3.10+ are reasonable minimums.
   - What's unclear: Exact minimum versions required by OpenClaw/NemoClaw.
   - Recommendation: Use conservative minimums; update when upstream docs clarify.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | OpenClaw runtime | ✓ | 20.17.0 | — |
| Python | NemoClaw runtime | ✓ | 3.12.2 | — |
| npm | Dependency install | ✓ | 11.11.1 | — |
| pip | Python deps | ✓ | 26.0.1 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — dev machine has full prerequisites.

## Sources

### Primary (HIGH confidence)
- Electron IPC documentation: https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron contextBridge: https://www.electronjs.org/docs/latest/api/context-bridge
- zustand persist middleware: https://github.com/pmndrs/zustand#persist-middleware
- framer-motion AnimatePresence: https://motion.dev/docs/react-animate-presence
- better-sqlite3 API: https://github.com/WiseLibs/better-sqlite3

### Secondary (MEDIUM confidence)
- Phase 1 implementation: `src/main/runtime/process-runner.ts`, `src/preload/platform-api.ts`
- STACK.md recommendations for SQLite and logging

### Tertiary (LOW confidence)
- OpenClaw/NemoClaw exact installation commands (not verified against upstream docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against npm registry, established patterns
- Architecture: HIGH — follows Phase 1 patterns, Electron best practices
- Pitfalls: MEDIUM — based on common Electron/React patterns, not project-specific experience

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable ecosystem, 30 days)
