# SecureClaw App

Desktop installer and lifecycle manager for OpenClaw and NVIDIA NemoClaw, built with Electron, TypeScript, and React.

## Project Structure

```
SecureClaw-app/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts
│   ├── renderer/       # React renderer process
│   └── shared/         # Shared code
│       ├── platform/   # Platform-specific utilities
│       └── ipc/        # IPC type definitions
├── dist/               # Build output
└── node_modules/       # Dependencies
```

## Available Scripts

- `npm run dev` - Start renderer development server (Vite)
- `npm run dev:renderer` - Same as `dev`
- `npm run dev:desktop` - Build main/preload and launch Electron against local Vite URL (`http://localhost:3000`)
- `npm run dev:desktop:sim-install` - Launch desktop with `SECURECLAW_DEV_SIMULATE_INSTALL=1` to simulate all install steps (no real OpenClaw/NemoClaw install)
- `npm run start` - Build main + renderer and launch Electron using built assets
- `npm run build` - Build main + preload + shared + renderer
- `npm run build:main` - Build main/preload/shared only
- `npm run build:renderer` - Build renderer only
- `npm test` - Run Jest tests
- `npm run test:watch` - Run Jest in watch mode
- `npm run type-check` - Run TypeScript type checking

## Tech Stack

- **Electron** - Desktop application framework
- **TypeScript** - Type-safe JavaScript (strict mode, targeting ES2020)
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Jest** - Testing framework with ts-jest
- **Zod** - Schema validation
- **Execa** - Process execution

## TypeScript Configuration

The project uses three TypeScript configurations:

1. `tsconfig.json` - Base configuration with strict settings
2. `tsconfig.main.json` - Main process configuration
3. `tsconfig.renderer.json` - Renderer process configuration

## Testing

Tests are configured with Jest and ts-jest. Coverage thresholds are set at 80% for branches, functions, lines, and statements.

Run tests with:
```bash
npm test
```

## Development Workflow

This project is set up for Test-Driven Development (TDD):

1. Write tests first
2. Run `npm run test:watch` for continuous feedback
3. Implement features to make tests pass
4. Run `npm run type-check` to verify TypeScript compliance

## Getting Started

For full desktop app UAT:

1. Terminal A: `npm run dev:renderer`
2. Terminal B: `npm run dev:desktop`

For built app run:

1. `npm run start`

For development on unsupported hardware (simulate install flow only):

1. Terminal A: `npm run dev:renderer`
2. Terminal B: `npm run dev:desktop:sim-install`
