# SecureClaw App

Secure clipboard manager built with Electron, TypeScript, and React.

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

- `npm run dev` - Start development server with Vite
- `npm run build` - Build the application
- `npm run build:main` - Build main process only
- `npm run build:renderer` - Build renderer process only
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

The project scaffolding is now complete. Begin implementing features by:

1. Creating test files in the appropriate directory
2. Writing failing tests
3. Implementing the functionality
4. Verifying with `npm test` and `npm run type-check`
