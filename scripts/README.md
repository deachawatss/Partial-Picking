# Development Scripts

## Overview

Utility scripts for development workflow automation.

## Scripts

### `kill-ports.sh`

Kills processes running on development ports before starting services.

**Usage:**
```bash
npm run clean:ports
# or
bash scripts/kill-ports.sh
```

**Ports Cleaned:**
- **6060, 6061** - Frontend (Vite dev server)
- **7075** - Backend (Rust Axum server)

**Note:** Does not clean port 5000 (Bridge service runs separately)

## npm Scripts (Root Level)

Run these commands from the project root:

### Development

```bash
# Start both frontend and backend (recommended)
npm run dev:all

# Start frontend only
npm run dev:frontend

# Start backend only
npm run dev:backend

# Clean ports manually
npm run clean:ports
```

### Installation

```bash
# Install all dependencies (root + frontend)
npm run install:all
```

### Build

```bash
# Build both services for production
npm run build:all

# Build frontend only
npm run build:frontend

# Build backend only
npm run build:backend
```

### Testing

```bash
# Run all tests
npm run test:all

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend
```

## Troubleshooting

### Port Already in Use

If you see "Port already in use" errors:

```bash
npm run clean:ports
```

This will kill any zombie processes on development ports.

### Permission Denied

If `kill-ports.sh` fails with permission errors:

```bash
chmod +x scripts/kill-ports.sh
```

Or run with sudo (not recommended):
```bash
sudo bash scripts/kill-ports.sh
```
