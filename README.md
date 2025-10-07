# Partial Picking System PWA

**Production-ready warehouse picking application with real-time weight scale integration, dual authentication, FEFO lot selection, and offline PWA capabilities.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange)](https://www.rust-lang.org/)
[![.NET](https://img.shields.io/badge/.NET-8.0-512bd4)](https://dotnet.microsoft.com/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE)

---

## Overview

The Partial Picking System is a modern Progressive Web Application (PWA) designed for warehouse operators to efficiently pick partial quantities of ingredients for production runs. The system integrates real-time weight scale data, enforces FEFO (First Expired, First Out) lot selection, and provides an offline-capable interface optimized for 1280x1024 touchscreen displays.

### Key Features

- **Real-Time Weight Integration**: Sub-200ms WebSocket updates from industrial weight scales
- **Dual Authentication**: LDAP (Active Directory) with SQL Server fallback
- **FEFO Compliance**: Automated lot selection based on expiration dates
- **4-Phase Atomic Transactions**: Guaranteed data consistency across lot allocation, weight updates, transaction recording, and inventory commitment
- **Offline PWA**: Full functionality without network connectivity
- **Optimized UI**: Designed for 1280x1024 touchscreen displays (WS1-WS4 workstations)
- **Audit Trail Preservation**: Complete picking history with constitutional compliance

---

## Technology Stack

### Frontend (Port 6060)
- **React 19** with TypeScript 5.3
- **Tailwind CSS 4** for styling
- **TanStack Query v5** for data fetching
- **Vite** for development and build tooling
- **Vitest** + **Playwright** for testing
- **ShadCN UI** components

### Backend (Port 7075)
- **Rust 1.75+** with **Axum 0.7** web framework
- **Tiberius** for SQL Server integration
- **JWT** authentication with bcrypt
- **LDAP** client for Active Directory
- **Tower** middleware for CORS, logging, and tracing

### Bridge Service (Port 5000)
- **.NET 8** WebSocket service
- **System.IO.Ports** for serial communication
- Real-time weight scale data streaming

### Database
- **SQL Server** TFCPILOT3 @ 192.168.0.86:49381
- Composite primary keys (no artificial IDs)
- 511 TFC1 PARTIAL bins

---

## Quick Start (5 Minutes)

### Prerequisites

- **Node.js** v20+ (for React 19)
- **Rust** 1.75+ (for Axum 0.7)
- **.NET 8 SDK** (for bridge service, Windows only)
- **Git**
- Access to **TFCPILOT3** database at 192.168.0.86:49381

### 1. Clone Repository

```bash
git clone <repository-url>
cd Partial-Picking
git checkout 001-i-have-an
```

### 2. Configure Environment

```bash
# Copy example configs
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env with your credentials
nano backend/.env
```

**Critical Settings**:
```bash
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
DATABASE_NAME=TFCPILOT3
DATABASE_USER=NSW
DATABASE_PASSWORD=B3sp0k3

LDAP_URL=ldap://192.168.0.1
JWT_SECRET=change-in-production
```

### 3. Install Dependencies

```bash
# Backend (Rust)
cd backend && cargo build && cd ..

# Frontend (React)
cd frontend && npm install && cd ..

# Bridge (optional for dev, required for scales)
cd bridge && dotnet restore && cd ..
```

### 4. Run Development Servers

**Terminal 1 - Backend**:
```bash
cd backend && cargo run
# 🚀 Backend running at http://localhost:7075
```

**Terminal 2 - Frontend**:
```bash
cd frontend && npm run dev
# 🎨 Frontend running at http://localhost:6060
```

**Terminal 3 - Bridge** (optional, Windows only):
```bash
cd bridge && dotnet run
# ⚖️ Bridge running at ws://localhost:5000
```

### 5. Access Application

Open browser: **http://localhost:6060**

**Test Credentials**:
- LDAP: `dechawat` / `TestPassword123`
- SQL: `warehouse_user` / `SqlPassword456`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   WAREHOUSE WORKSTATIONS                        │
│              (WS1, WS2, WS3, WS4 @ 1280x1024)                   │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP + WebSocket
             ↓
┌────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19 PWA)                      │
│  - React 19 Concurrent Features (useTransition)                │
│  - TanStack Query v5 (data fetching)                           │
│  - ShadCN UI Components (Tailwind 4)                           │
│  - Service Worker (offline mode)                               │
└────────────┬───────────────────────────────────────────────────┘
             │
             │ REST API (JWT Auth)
             ↓
┌────────────────────────────────────────────────────────────────┐
│                    BACKEND (Rust + Axum)                        │
│  - Authentication (LDAP + SQL fallback)                        │
│  - 4-Phase Atomic Transactions                                 │
│  - FEFO Lot Selection Algorithm                                │
│  - Business Logic Enforcement                                  │
└────────┬───────────────────────────────────────────────────────┘
         │                               │
         │ SQL Server                    │ WebSocket Client
         │ (Tiberius)                    │ (Weight Data)
         ↓                               ↓
┌──────────────────────┐    ┌──────────────────────────────────┐
│   SQL SERVER DB      │    │  BRIDGE SERVICE (.NET 8)         │
│   TFCPILOT3          │    │  - Serial Port Communication     │
│   192.168.0.86:49381 │    │  - WebSocket Server              │
│                      │    │  - Weight Scale Protocol         │
│  - cust_PartialRun   │    └───────────┬──────────────────────┘
│  - cust_PartialPicked│                │
│  - LotMaster         │                │ Serial (COM1, COM2)
│  - BINMaster         │                ↓
│  - LotTransaction    │    ┌──────────────────────────────────┐
└──────────────────────┘    │  WEIGHT SCALES (Industrial)      │
                            │  - SMALL Scale (COM1 per WS)     │
                            │  - BIG Scale (COM2 per WS)       │
                            └──────────────────────────────────┘
```

---

## Development Workflow

### Run Tests

```bash
# Backend Unit Tests
cd backend && cargo test

# Backend Contract Tests
cd backend && cargo test --test '*_contract_test'

# Frontend Unit Tests
cd frontend && npm test

# Frontend E2E Tests (Playwright)
cd frontend && npm run test:e2e
```

### Code Quality

```bash
# Rust Formatting and Linting
cd backend
cargo fmt --check  # Check formatting
cargo fmt          # Apply formatting
cargo clippy       # Linting

# TypeScript Formatting and Linting
cd frontend
npm run lint       # ESLint check
npm run lint:fix   # Auto-fix ESLint issues
npm run format     # Prettier format
```

### Build for Production

```bash
# Backend (release build)
cd backend && cargo build --release

# Frontend (production bundle)
cd frontend && npm run build

# Bridge (release build)
cd bridge && dotnet build -c Release
```

---

## Project Structure

```
Partial-Picking/
├── backend/                    # Rust + Axum backend
│   ├── src/
│   │   ├── api/               # API route handlers
│   │   │   ├── auth.rs        # Authentication endpoints
│   │   │   ├── runs.rs        # Production run endpoints
│   │   │   ├── picks.rs       # Picking transaction endpoints
│   │   │   └── lots.rs        # FEFO lot management
│   │   ├── services/          # Business logic layer
│   │   ├── models/            # Data models
│   │   ├── utils/             # JWT, LDAP, helpers
│   │   └── main.rs            # Application entry
│   ├── tests/                 # Integration tests
│   │   ├── contract/          # Contract tests (TDD)
│   │   └── performance/       # Performance tests
│   ├── Cargo.toml             # Dependencies
│   └── .env.example           # Environment template
│
├── frontend/                   # React 19 PWA
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── picking/       # Picking workflow components
│   │   │   ├── shared/        # Shared UI components
│   │   │   └── ui/            # ShadCN UI primitives
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and API clients
│   │   ├── pages/             # Page components
│   │   └── main.tsx           # Application entry
│   ├── tests/                 # E2E tests (Playwright)
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies
│   └── vite.config.ts         # Vite configuration
│
├── bridge/                     # .NET 8 bridge service
│   ├── Services/              # Scale communication
│   ├── Models/                # Data models
│   ├── Program.cs             # WebSocket server
│   └── bridge.csproj          # .NET project file
│
├── docs/                       # Documentation
│   ├── API.md                 # REST API reference
│   ├── DEPLOYMENT.md          # Production deployment guide
│   ├── ARCHITECTURE.md        # System architecture
│   ├── TESTING.md             # Testing guide
│   └── frontend-ref-DontEdit/ # Angular reference (DO NOT MODIFY)
│
├── specs/                      # Specifications
│   └── 001-i-have-an/         # Feature branch specs
│       ├── contracts/         # OpenAPI, WebSocket specs
│       ├── data-model.md      # Database schema
│       └── quickstart.md      # Validation scenarios
│
├── CLAUDE.md                  # Agent guidance (< 300 lines)
├── CHANGELOG.md               # Version history
├── CONTRIBUTING.md            # Contribution guidelines
└── README.md                  # This file
```

---

## Documentation

- **[API Reference](./docs/API.md)**: Complete REST API endpoint documentation
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Production deployment to 192.168.0.10
- **[Architecture](./docs/ARCHITECTURE.md)**: System architecture and design patterns
- **[Testing Guide](./docs/TESTING.md)**: Unit, E2E, and performance testing
- **[Quick Start](./specs/001-i-have-an/quickstart.md)**: 10 validation scenarios
- **[Data Model](./specs/001-i-have-an/data-model.md)**: Database schema specification
- **[OpenAPI Spec](./specs/001-i-have-an/contracts/openapi.yaml)**: REST API contract
- **[WebSocket Protocol](./specs/001-i-have-an/contracts/websocket.md)**: Weight scale protocol

---

## Constitutional Principles (Compliance Required)

All code MUST comply with these 8 constitutional principles:

1. **Contract-First Development**: Validate against OpenAPI and WebSocket specs
2. **Type Safety**: TypeScript strict mode + Rust compile-time guarantees
3. **TDD with Failing Tests**: Write contract tests FIRST (must fail initially)
4. **Atomic Transactions**: 4-phase picking executes atomically with rollback
5. **Real-Time Performance**: WebSocket weight updates <200ms latency
6. **Security by Default**: JWT auth, CORS, input validation, parameterized queries
7. **Audit Trail Preservation**: NEVER delete audit metadata (ItemBatchStatus, PickingDate)
8. **No Artificial Keys**: Use composite keys (RunNo, RowNum, LineId)

See [CLAUDE.md](./CLAUDE.md) for detailed agent guidance.

---

## Environment Configuration

### Development (.env)

```bash
# Backend (backend/.env)
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
DATABASE_NAME=TFCPILOT3
SERVER_PORT=7075
LDAP_URL=ldap://192.168.0.1
JWT_SECRET=dev-secret-change-in-production

# Frontend (frontend/.env)
VITE_API_URL=http://localhost:7075/api
VITE_WS_URL=ws://localhost:5000
```

### Production (.env.production)

```bash
# Backend
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
SERVER_PORT=7075
CORS_ALLOWED_ORIGINS=http://192.168.0.10:6060
JWT_SECRET=<strong-production-secret>

# Frontend
VITE_API_URL=http://192.168.0.10:7075/api
VITE_WS_URL=ws://192.168.0.10:5000
```

**⚠️ WARNING**: NEVER commit `.env` files. Always use `.env.example` templates.

---

## Deployment

### Development Deployment

See [Quick Start](#quick-start-5-minutes) above.

### Production Deployment (Windows Server @ 192.168.0.10)

**Full deployment guide**: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

**Quick deployment**:

```powershell
# 1. Build backend (release)
cd backend
cargo build --release

# 2. Build frontend (production)
cd frontend
npm run build

# 3. Configure IIS for frontend static files (or use HTTP server)

# 4. Start backend as Windows service
sc.exe create PartialPickingBackend binPath="C:\PartialPicking\backend\target\release\backend.exe"
sc.exe start PartialPickingBackend

# 5. Verify bridge service running (existing service at port 5000)

# 6. Test health checks
curl http://192.168.0.10:7075/api/health
```

---

## Troubleshooting

### Backend won't start - Database connection failed

```bash
# Verify .env configuration
cat backend/.env | grep DATABASE

# Test connection
cd backend
cargo test --test db_connection_test -- --nocapture

# Check network connectivity
ping 192.168.0.86
telnet 192.168.0.86 49381
```

### LDAP authentication fails

```bash
# Verify LDAP configuration
cat backend/.env | grep LDAP

# Use SQL authentication fallback
curl -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"warehouse_user","password":"SqlPassword456"}'
```

### WebSocket connection refused

```bash
# Check bridge service running
netstat -an | grep 5000

# Start bridge service (Windows)
cd bridge && dotnet run

# Test WebSocket health
wscat -c ws://localhost:5000/ws/health
```

### Frontend build fails

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Check Node.js version (must be v20+)
node --version
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style guidelines, testing requirements, and pull request process.

**Quick checklist**:
- ✅ Code follows Rust fmt and ESLint standards
- ✅ All tests pass (unit + E2E + contract)
- ✅ Constitutional principles verified
- ✅ Documentation updated
- ✅ No breaking changes without approval

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for version history and release notes.

**Current Version**: 1.0.0 (Initial Release)

---

## License

Proprietary software © 2025 Newly Weds Foods Thailand. All rights reserved.

See [LICENSE](./LICENSE) for details.

---

## Support

**Project Repository**: [GitHub Repository URL]
**Issue Tracker**: [GitHub Issues URL]
**Email**: support@nwfth.com
**Documentation**: [docs/](./docs/)

---

## Acknowledgments

- **Newly Weds Foods Thailand**: Project sponsorship and requirements
- **Rust Community**: Axum, Tiberius, and ecosystem libraries
- **React Team**: React 19 concurrent features
- **ShadCN**: UI component library

---

**Built with 💚 for warehouse operators at NWFTH Thailand**

*Last Updated: 2025-10-07 | Version 1.0.0 | Branch: 001-i-have-an*
