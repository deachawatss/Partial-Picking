# Changelog

All notable changes to the Partial Picking System PWA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-10-07

### 🎉 Initial Release

**Production-ready warehouse picking application with real-time weight scale integration, dual authentication, FEFO lot selection, and offline PWA capabilities.**

### ✨ Added

#### Frontend (React 19 PWA)
- Progressive Web Application with offline capability
- Real-time weight scale integration via WebSocket (<200ms latency)
- Optimized UI for 1280x1024 touchscreen displays (WS1-WS4)
- Auto-population of run details (FG Item Key, Description, Batches)
- FEFO-sorted lot selection interface
- Real-time weight progress bar with tolerance validation
- Workstation selection with persistent configuration
- Service Worker for offline data caching
- React 19 concurrent features for smooth UI updates

#### Backend (Rust + Axum 0.7)
- Dual authentication (LDAP + SQL fallback with bcrypt)
- JWT token authentication (168-hour expiration)
- 4-phase atomic picking transactions with rollback
- FEFO lot selection algorithm (DateExpiry ASC)
- TFC1 PARTIAL bin filtering (511 bins)
- Weight tolerance validation against INMAST.User9
- Production run management endpoints
- Lot availability querying
- Workstation configuration endpoints
- Sequence number generation (PT for pallets)
- Comprehensive error handling with correlation IDs

#### Bridge Service (.NET 8)
- WebSocket server for real-time weight streaming
- Serial port communication with industrial scales
- Continuous mode weight polling (100ms interval)
- SMALL and BIG scale support per workstation
- Automatic reconnection handling
- Configurable COM port and baud rate

#### Database Integration
- SQL Server TFCPILOT3 @ 192.168.0.86:49381
- Composite primary keys (RunNo+RowNum+LineId)
- Audit trail preservation (ItemBatchStatus, PickingDate retained)
- 4-phase transaction: Lot allocation → Weight update → Transaction record → Inventory commit

#### Testing Infrastructure
- 30+ backend unit tests (Rust cargo test)
- 31+ frontend E2E tests (Playwright at 1280x1024)
- 15+ contract tests validating OpenAPI compliance
- 10+ performance tests (latency and throughput)
- Test fixtures and mocks for development

#### Documentation
- Comprehensive README with quick start guide
- Complete API documentation (REST + WebSocket)
- Production deployment guide for Windows Server
- System architecture documentation
- Testing guide with examples
- 10 validation scenarios for environment setup
- Data model specification
- OpenAPI 3.0.3 specification
- WebSocket protocol specification

#### Developer Experience
- TypeScript strict mode (frontend)
- Rust Clippy linting (backend)
- ESLint + Prettier (frontend)
- Cargo fmt (backend)
- Vite development server with HMR
- Environment configuration templates (.env.example)
- Git pre-commit hooks

### 🔧 Technical Details

**Frontend Stack**:
- React 19.0 with TypeScript 5.3
- Tailwind CSS 4
- TanStack Query v5
- Vite build tool
- ShadCN UI components
- Vitest + Playwright testing

**Backend Stack**:
- Rust 1.75+
- Axum 0.7 web framework
- Tiberius (SQL Server driver)
- ldap3 (Active Directory)
- jsonwebtoken (JWT)
- bcrypt (password hashing)
- Tower middleware (CORS, logging)

**Bridge Stack**:
- .NET 8
- System.IO.Ports (serial communication)
- WebSocket server (Kestrel)

**Database**:
- SQL Server TFCPILOT3
- Composite keys (no artificial IDs)
- Connection pooling (2-10 connections)

### 📋 Constitutional Compliance

All code adheres to 8 constitutional principles:

1. ✅ Contract-First Development (OpenAPI validated)
2. ✅ Type Safety (TypeScript strict + Rust compile-time)
3. ✅ TDD with Failing Tests (contract tests first)
4. ✅ Atomic Transactions (4-phase with rollback)
5. ✅ Real-Time Performance (<200ms WebSocket)
6. ✅ Security by Default (JWT, CORS, parameterized queries)
7. ✅ Audit Trail Preservation (metadata never deleted)
8. ✅ No Artificial Keys (composite keys only)

### 🚀 Performance Metrics

- API Response Time: < 500ms (p95)
- WebSocket Latency: < 200ms (p99)
- Database Query Time: < 100ms (average)
- Frontend Load Time: < 3 seconds
- Bundle Size: < 500 KB (gzipped)

### 🔒 Security

- LDAP authentication against Active Directory
- SQL authentication with bcrypt password hashing
- JWT tokens (HS256, 168-hour expiration)
- CORS configured for production origins
- Parameterized SQL queries (no SQL injection)
- React auto-escaping (XSS protection)
- Environment variables for secrets

### 📦 Deployment

**Production Environment**:
- Application Server: 192.168.0.10 (Windows Server)
- Database Server: 192.168.0.86:49381 (SQL Server)
- Workstations: WS1-WS4 (1280x1024 touchscreen)
- Weight Scales: SMALL (COM1), BIG (COM2) per workstation

**Deployment Method**:
- Frontend: IIS static files (port 6060)
- Backend: Windows Service via NSSM (port 7075)
- Bridge: Windows Service (port 5000, existing)
- Health checks: /api/health endpoint

### 🐛 Known Issues

None reported for v1.0.0.

### 📝 Notes

- **Bridge Service**: Existing service at port 5000 (no modification required)
- **Offline Mode**: PWA caches assets and API responses
- **Workstation Selection**: Persisted in browser localStorage
- **Label Printing**: Requires configured label printer (not included in this release)
- **HTTPS**: Not implemented (internal network only)

---

## [Unreleased]

### Planned Features (Future Releases)

- HTTPS support for production
- Label printing integration (Zebra printer)
- Advanced reporting and analytics
- Multi-language support (English, Thai)
- Mobile app (React Native)
- Barcode scanning integration
- Real-time inventory dashboard
- User management UI
- Role-based access control (RBAC)
- Audit log viewer

### Potential Improvements

- Database migrations tool
- Automated backup system
- Prometheus metrics exporter
- Grafana dashboards
- Horizontal scaling support
- Load balancer configuration
- Database read replicas
- CDN for static assets

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2025-10-07 | Initial production release |

---

## Upgrade Guide

### Upgrading from Development to v1.0.0

1. Stop development servers
2. Build release binaries (backend + frontend)
3. Deploy to production (see [DEPLOYMENT.md](./docs/DEPLOYMENT.md))
4. Run validation scenarios (see [quickstart.md](./specs/001-i-have-an/quickstart.md))
5. Verify health checks

### Future Upgrades

Upgrade procedures will be documented for each release.

---

## Support

**Documentation**: [docs/](./docs/)
**Issue Tracker**: [GitHub Issues]
**Email**: support@nwfth.com

---

**Maintainers**: Partial Picking System Development Team
**License**: Proprietary © 2025 Newly Weds Foods Thailand

---

*Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)*
*Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)*
