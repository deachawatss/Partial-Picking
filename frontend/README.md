# Partial Picking System - Frontend

**React 19 + TypeScript + Tailwind CSS + Vite PWA**

Production-ready warehouse picking application with real-time weight scale integration, offline capabilities, and FEFO compliance.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 6060)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Tech Stack

- **Framework**: React 19 (concurrent rendering)
- **Language**: TypeScript 5.3 (strict mode)
- **Styling**: Tailwind CSS 3 + shadcn/ui
- **Build**: Vite 6
- **PWA**: vite-plugin-pwa 0.21.2 + Workbox
- **State**: Zustand (global) + React Context (auth, picking)
- **API**: TanStack Query v5 + Axios
- **WebSocket**: Native WebSocket API
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Cache**: IndexedDB (idb library)

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                    # Entry + SW registration
│   ├── App.tsx                     # Root with routing
│   ├── components/
│   │   ├── ui/                     # shadcn/ui base components
│   │   ├── picking/                # Domain components
│   │   └── shared/                 # Shared components
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── PartialPickingPage.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── PickingContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWeightScale.ts       # WebSocket integration
│   │   ├── usePicking.ts
│   │   └── useOnlineStatus.ts      # PWA offline detection
│   ├── services/
│   │   ├── api/                    # API client
│   │   ├── cache.ts                # IndexedDB cache (PWA)
│   │   └── websocket.ts            # WebSocket class
│   └── types/
│       └── api.ts                  # API type definitions
├── tests/
│   ├── unit/                       # Vitest unit tests
│   └── e2e/                        # Playwright E2E tests
├── public/
│   ├── pwa-192x192.png             # PWA icon
│   ├── pwa-512x512.png             # PWA icon
│   └── favicon.ico
├── scripts/
│   └── generate-pwa-icons.mjs      # Icon generator
├── docs/
│   └── PWA_IMPLEMENTATION.md       # PWA documentation
├── vite.config.ts                  # Vite + PWA config
├── vitest.config.ts                # Test config
└── tailwind.config.ts              # Tailwind config
```

## PWA Features

### Offline Mode

The app works offline with intelligent caching:

- **Last 5 runs cached** (FIFO eviction)
- **Network-first strategy** for API calls
- **Cache fallback** when offline
- **Service worker** precaches app shell
- **Offline banner** shows network status
- **Weight operations disabled** when offline

### Testing Offline Mode

**Chrome DevTools**:
1. DevTools → **Application** tab
2. **Service Workers**: Check service worker status
3. Toggle "Offline" checkbox
4. **IndexedDB** → `partial-picking-cache` → `runs`: View cached runs
5. **Cache Storage**: View cached API responses

**Manual Testing**:
```bash
# 1. Start dev server
npm run dev

# 2. Load a run (e.g., run 12345)
# 3. Toggle offline in DevTools
# 4. Refresh page - run loads from cache
# 5. Verify offline banner appears
# 6. Check "Save Pick" is disabled
```

### Cache Management

```typescript
import { getCacheStats, clearCache } from '@/services/cache';

// Check cache stats
const stats = await getCacheStats();
console.log(`Cache: ${stats.count}/${stats.maxSize} runs`);

// Clear cache
await clearCache();
```

## Development

### Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
VITE_API_URL=http://localhost:7075
VITE_WS_URL=ws://localhost:5000
```

### Running Services

**Terminal 1 - Backend** (Rust, port 7075):
```bash
cd ../backend
cargo run
```

**Terminal 2 - Frontend** (React, port 6060):
```bash
npm run dev
```

**Terminal 3 - Bridge** (.NET, port 5000):
```bash
cd ../bridge
dotnet run
```

### Adding Components

**shadcn/ui components**:
```bash
# Install component
npx shadcn-ui@latest add button

# Component added to src/components/ui/button.tsx
```

**Custom components**:
```typescript
// src/components/picking/MyComponent.tsx
export function MyComponent() {
  const isOnline = useOnlineStatus(); // PWA offline detection

  return (
    <div>
      {!isOnline && <p>Offline mode</p>}
    </div>
  );
}
```

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm test

# Run specific test
npm test -- --run cache.test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

**Test Files**:
- `tests/unit/cache.test.ts` - IndexedDB cache service (11 tests)
- `tests/unit/useOnlineStatus.test.ts` - Offline detection hook (7 tests)

### E2E Tests (Playwright)

```bash
# Install browsers (first time)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npx playwright test --ui
```

## Building for Production

```bash
# Build
npm run build

# Output: dist/
# - index.html
# - assets/*.js (minified)
# - assets/*.css (minified)
# - sw.js (service worker)
# - manifest.webmanifest (PWA manifest)
```

**Build Output**:
```
✓ built in 5.86s

PWA v0.21.2
mode      generateSW
precache  13 entries (663.06 KiB)
files generated
  dist/sw.js
  dist/workbox-b8613c59.js
```

**HTTPS Requirement**: PWA features require HTTPS in production (works on localhost for dev)

## Code Quality

### Linting

```bash
# ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Formatting

```bash
# Prettier
npm run format

# Check formatting
npm run format -- --check
```

### TypeScript

```bash
# Type check
npx tsc --noEmit

# Build with type checking
npm run build
```

## Key Features

### React 19 Concurrent Rendering

```typescript
// WebSocket updates with useTransition (non-blocking)
import { useTransition } from 'react';

const [weight, setWeight] = useState(0);
const [isPending, startTransition] = useTransition();

ws.onmessage = (event) => {
  startTransition(() => {
    setWeight(event.data.weight); // Non-blocking update
  });
};
```

### Offline Detection

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function MyComponent() {
  const isOnline = useOnlineStatus();

  return (
    <button disabled={!isOnline}>
      {isOnline ? 'Save' : 'Offline'}
    </button>
  );
}
```

### API with Cache

```typescript
import { getRunDetails } from '@/services/api/runs';

// Network-first, cache fallback
const run = await getRunDetails(12345);
// - Online: Fetches from API, caches result
// - Offline: Returns cached data if available
```

## Troubleshooting

### Service Worker Not Updating

```bash
# Clear service worker cache
# DevTools → Application → Service Workers → Unregister
# DevTools → Application → Storage → Clear storage
```

### IndexedDB Errors

```typescript
// Clear cache programmatically
import { clearCache } from '@/services/cache';
await clearCache();
```

### Build Errors

```bash
# Clean build
rm -rf dist/
rm -rf node_modules/
npm install
npm run build
```

### TypeScript Errors

```bash
# Regenerate type declarations
npx tsc --noEmit

# Check vite-env.d.ts includes PWA types
# Should have: /// <reference types="vite-plugin-pwa/client" />
```

## Performance

### Metrics

- **Initial Load**: <2s on 3G
- **WebSocket Latency**: <200ms (React 19 concurrent rendering)
- **Cache Lookup**: <10ms (IndexedDB)
- **Lighthouse PWA Score**: >90

### Optimization Tips

1. **Code Splitting**: Use dynamic imports
   ```typescript
   const Modal = lazy(() => import('./Modal'));
   ```

2. **Image Optimization**: Use WebP format
   ```html
   <img src="image.webp" alt="..." />
   ```

3. **Cache Strategy**: Network-first for API, cache-first for assets

4. **Bundle Size**: Check with `npm run build` (warning if >500KB)

## Resources

- **Documentation**: `docs/PWA_IMPLEMENTATION.md`
- **Constitution**: `.specify/memory/constitution.md`
- **API Contracts**: `../specs/001-i-have-an/contracts/openapi.yaml`
- **Data Model**: `../specs/001-i-have-an/data-model.md`

## License

Proprietary - Northwest Fish Co.

---

**Questions?** Contact the Frontend Builder agent or check CLAUDE.md for agent orchestration.
