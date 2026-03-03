# Contributing to LACE

Thank you for your interest in contributing to LACE (Local Agent Compute Environment)! This guide will help you get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Code Style Guidelines](#code-style-guidelines)
- [Submitting Issues](#submitting-issues)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Code of Conduct](#code-of-conduct)

## Development Setup

### Prerequisites

- **Node.js** 18 or higher
- **npm** (comes with Node.js)

### Getting Started

1. **Fork** the repository on GitHub.

2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/lace.git
   cd lace
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   This starts an Express backend and a Vite dev server. The app will be available at `http://localhost:5000`.

5. **Open the app** in your browser, click "Init Runtime" to load Pyodide, and verify everything works.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server (Express + Vite HMR) |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run check` | Run TypeScript type checking |

## Project Architecture

LACE is a **frontend-heavy application**. The Express backend only serves static files; all Python execution happens client-side via Pyodide (CPython compiled to WebAssembly) running in a Web Worker.

### Directory Structure

```
client/
  src/
    pages/
      lace.tsx              # Main page: split-pane layout with sidebar, editor, terminal
    hooks/
      use-pyodide.ts        # Hook managing Pyodide Web Worker lifecycle, file ops, packages
    components/
      file-explorer.tsx     # Sidebar file tree for in-memory /workspace filesystem
      package-installer.tsx # UI for installing Python packages via micropip
      toolbar.tsx           # Control buttons (Init, Run, Stop, Clear, Snapshots)
      terminal-output.tsx   # Streaming stdout/stderr/system output display
      shortcuts-help.tsx    # Keyboard shortcuts overlay
      ui/                   # shadcn/ui base components
    lib/
      queryClient.ts        # TanStack Query client setup
      utils.ts              # Utility functions (cn helper)
  public/
    pyodide-worker.js       # Web Worker that loads and runs Pyodide
server/
  index.ts                  # Express server entry point
  routes.ts                 # API routes (minimal)
  vite.ts                   # Vite dev server integration
  static.ts                 # Static file serving
shared/                     # Shared types/schemas (if any)
```

### Key Concepts

- **Pyodide Web Worker** (`pyodide-worker.js`): Loads the Pyodide WASM runtime from CDN and executes Python code in a background thread, keeping the UI responsive.
- **`use-pyodide` hook**: Manages the worker lifecycle, sends messages to it, and processes responses (stdout, stderr, file system operations).
- **In-memory filesystem**: Workspace files live in Pyodide's virtual filesystem at `/workspace`. Snapshots export/import these files as JSON.
- **Monaco Editor**: Provides the code editing experience with Python syntax highlighting.

## Code Style Guidelines

### TypeScript

- Use TypeScript for all source files.
- Prefer `const` over `let`; avoid `var`.
- Use explicit types for function parameters and return values when they aren't obvious.
- Use interfaces for object shapes; use type aliases for unions and intersections.

### React

- Use functional components with hooks.
- Do **not** explicitly import React (the Vite JSX transformer handles this).
- Use `wouter` for client-side routing.
- Use `@tanstack/react-query` for any data fetching.
- Keep components focused: one component per concern.

### Styling

- Use **Tailwind CSS** utility classes for styling.
- Use **shadcn/ui** base components from `client/src/components/ui/` rather than building custom equivalents.
- Follow the existing dark theme; LACE is dark-mode only.
- Use `lucide-react` for icons.

### General

- Add `data-testid` attributes to interactive elements and elements displaying meaningful information.
- Keep files focused and minimal; avoid unnecessary abstractions.
- Write clear, descriptive variable and function names.

## Submitting Issues

We welcome bug reports, feature requests, and general feedback. When opening an issue, please include:

### Bug Reports

- **Summary**: A clear, concise description of the bug.
- **Steps to Reproduce**: Numbered steps to consistently reproduce the issue.
- **Expected Behavior**: What you expected to happen.
- **Actual Behavior**: What actually happened.
- **Environment**: Browser name and version, OS, Node.js version.
- **Screenshots or Logs**: If applicable, include browser console output or screenshots.

### Feature Requests

- **Problem**: Describe the problem or use case the feature would address.
- **Proposed Solution**: Describe what you'd like to see.
- **Alternatives Considered**: Any other approaches you've thought about.

## Submitting Pull Requests

### Workflow

1. **Fork** the repository and create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**. Follow the code style guidelines above.

3. **Test your changes**:
   - Run `npm run check` to verify TypeScript compiles without errors.
   - Run `npm run dev` and manually test the affected functionality.
   - Verify the app initializes Pyodide, runs Python code, and displays output correctly.

4. **Commit** your changes with a clear, descriptive commit message:
   ```bash
   git commit -m "Add feature: description of what you did"
   ```

5. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch of the upstream repository.

### PR Guidelines

- Keep pull requests focused on a single change or feature.
- Provide a clear description of what the PR does and why.
- Reference any related issues (e.g., "Fixes #42").
- Ensure TypeScript type checking passes (`npm run check`).
- Be responsive to review feedback.

### Branch Naming

- `feature/` - New features (e.g., `feature/add-dark-theme-toggle`)
- `fix/` - Bug fixes (e.g., `fix/worker-timeout-handling`)
- `docs/` - Documentation changes (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-worker-messaging`)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue.

---

Thank you for contributing to LACE!
