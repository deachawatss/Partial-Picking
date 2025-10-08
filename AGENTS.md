# Repository Guidelines

## Project Structure & Module Organization
Source code lives in language-specific roots: `frontend/` holds the React 19 PWA (UI, service worker, tests under `src/__tests__`), `backend/` contains the Axum-based Rust API (`src/`, `tests/contract`, `tests/unit`, `tests/performance`), and `Weight-scale/bridge-service/` provides the .NET WebSocket relay for serial weight scales. Shared automation (port cleanup, installers) sits in `scripts/`, `installer-package/`, and operational docs live in `docs/` and `specs/`. Place new assets beside their consuming feature to keep the domain-driven layout intact.

## Build, Test, and Development Commands
Use top-level npm scripts to orchestrate multi-service work: `npm run dev:backend` (Rust API on 7075), `npm run dev:frontend` (Vite dev server on 6060), and `npm run dev:all` to spin up both after cleaning stale ports. Release builds ship via `npm run build:backend` and `npm run build:frontend`; run together with `npm run build:all`. CI mirrors `npm run test:backend` (Cargo test suite) and `npm run test:frontend` (Vitest). Invoke `frontend/npm run lint` and `frontend/npm run format` before submitting UI-heavy changes.

## Coding Style & Naming Conventions
Frontend code follows TypeScript strict mode with 2-space indentation, React components in PascalCase files (`PickTicketPanel.tsx`) and hooks in camelCase (`useLotSelection`). Tailwind utility groups read left-to-right: layout → spacing → color. Run `npm run lint` to enforce ESLint rules and `npm run format` for Prettier. Backend Rust modules align with `rustfmt` defaults; feature folders mirror API domains (e.g., `src/picking`). Prefer snake_case for functions, SCREAMING_SNAKE_CASE for environment constants, and PascalCase for structs/enums. Keep bridge-service classes in PascalCase and namespaces under `WeightScale.Bridge.*`.

## Testing Guidelines
Backend contract, unit, and performance suites live under `backend/tests`; extend them by adding `_tests.rs` files to the matching folder and run with `npm run test:backend`. Mock external systems via existing helper fixtures rather than touching production hosts. Frontend unit tests rely on Vitest with Testing Library; create files alongside components using `.test.tsx` naming. End-to-end scenarios reside in `frontend/tests/e2e`; execute with `frontend/npm run test:e2e` once the backend is seeded. Target ≥80% coverage on new modules and document skipped tests with TODOs referencing Jira or GitHub issues.

## Commit & Pull Request Guidelines
History favors imperative, concise subjects (`Add port cleanup script`, `Fix FEFO allocation rounding`). Keep bodies wrapped at 72 chars with context, and reference tickets using `[#123]` when applicable. Pull requests should summarize impact, list affected services, link to design docs, and attach UI screenshots or API traces when behavior changes. Confirm linting and both test suites locally; note any intentional omissions in the PR checklist so reviewers can focus on substantive changes.

playwright / dev-tools  credentials =  deachawat / Wind@password9937