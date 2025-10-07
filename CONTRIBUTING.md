# Contributing to Partial Picking System PWA

Thank you for your interest in contributing to the Partial Picking System! This document provides guidelines for development, testing, and contributing code.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Style Guidelines](#code-style-guidelines)
4. [Testing Requirements](#testing-requirements)
5. [Pull Request Process](#pull-request-process)
6. [Constitutional Compliance Checklist](#constitutional-compliance-checklist)
7. [Commit Message Guidelines](#commit-message-guidelines)
8. [Code Review Process](#code-review-process)

---

## Getting Started

### Prerequisites

- Node.js v20+
- Rust 1.75+
- .NET 8 SDK (Windows only, for bridge service)
- Git
- Access to TFCPILOT3 database

### Quick Setup

```bash
# Clone repository
git clone <repository-url>
cd Partial-Picking

# Install dependencies
cd backend && cargo build && cd ..
cd frontend && npm install && cd ..

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your credentials

# Run development servers
# Terminal 1
cd backend && cargo run

# Terminal 2
cd frontend && npm run dev
```

See [README.md](./README.md) for detailed setup instructions.

---

## Development Setup

### Branch Naming Convention

```
feature/<feature-name>     # New features
bugfix/<bug-description>   # Bug fixes
hotfix/<critical-fix>      # Production hotfixes
refactor/<refactor-name>   # Code refactoring
docs/<documentation>       # Documentation updates
test/<test-name>           # Test additions/updates
```

**Example**: `feature/add-barcode-scanning`, `bugfix/fix-weight-tolerance`

### Development Workflow

1. Create feature branch from `001-i-have-an` (or `main`)
2. Write failing tests (TDD)
3. Implement feature
4. Ensure tests pass
5. Format and lint code
6. Commit with descriptive message
7. Push branch
8. Create pull request

---

## Code Style Guidelines

### Rust (Backend)

**Formatting**: Use `cargo fmt`

```bash
cd backend
cargo fmt           # Format code
cargo fmt --check   # Check formatting without changes
```

**Linting**: Use `cargo clippy`

```bash
cargo clippy        # Run linter
cargo clippy --fix  # Auto-fix linting issues
```

**Style Rules**:
- Use `snake_case` for variables and functions
- Use `PascalCase` for types and structs
- Maximum line length: 100 characters
- Use meaningful variable names (no single letters except iterators)
- Add rustdoc comments for public items

**Example**:
```rust
/// Authenticate user with LDAP or SQL credentials.
///
/// # Arguments
/// * `username` - User's username
/// * `password` - User's password (plain text)
///
/// # Returns
/// * `Ok(LoginResponse)` - Successful authentication with JWT token
/// * `Err(ApiError)` - Authentication failed
pub async fn login(
    username: String,
    password: String,
) -> Result<LoginResponse, ApiError> {
    // Implementation
}
```

### TypeScript (Frontend)

**Formatting**: Use Prettier

```bash
cd frontend
npm run format       # Format code
npm run format:check # Check formatting
```

**Linting**: Use ESLint

```bash
npm run lint         # Run linter
npm run lint:fix     # Auto-fix linting issues
```

**Style Rules**:
- Use `camelCase` for variables and functions
- Use `PascalCase` for types, interfaces, and React components
- Maximum line length: 100 characters
- Use meaningful variable names
- Add JSDoc comments for exported functions

**Example**:
```typescript
/**
 * Custom hook for managing WebSocket connection to weight scale.
 *
 * @param workstationId - Workstation identifier (e.g., "WS-001")
 * @param scaleType - Scale type ("small" or "big")
 * @returns Weight scale state (weight, stable, isPending)
 *
 * @example
 * const { weight, stable, isPending } = useWeightScale('WS-001', 'small');
 */
export function useWeightScale(
  workstationId: string,
  scaleType: 'small' | 'big'
): WeightScaleState {
  // Implementation
}
```

### .NET (Bridge Service)

**Formatting**: Use Visual Studio defaults

```bash
cd bridge
dotnet format       # Format code
```

**Style Rules**:
- Use `PascalCase` for classes, methods, properties
- Use `camelCase` for local variables
- Add XML documentation comments for public members

---

## Testing Requirements

### Required Tests

All code changes MUST include tests:

1. **Unit Tests**: Test individual functions/components
2. **Integration Tests**: Test database interactions (backend only)
3. **E2E Tests**: Test critical user workflows (frontend only)
4. **Contract Tests**: Validate against OpenAPI spec (backend only)

### Running Tests

**Backend**:
```bash
cd backend
cargo test                      # All tests
cargo test --test contract_test # Contract tests only
cargo test -- --nocapture       # With output
```

**Frontend**:
```bash
cd frontend
npm test                        # Unit tests
npm run test:e2e                # E2E tests
npm test -- --coverage          # With coverage
```

### Test Coverage Requirements

- Backend: 80%+ coverage
- Frontend: 70%+ coverage
- Critical paths: 100% E2E coverage

### Writing Good Tests

```rust
// ✅ Good: Clear name, single assertion, isolated
#[test]
fn test_jwt_token_validates_successfully_with_correct_secret() {
    let token = generate_jwt_token(42, "user", "secret").unwrap();
    let claims = validate_jwt_token(&token, "secret").unwrap();
    assert_eq!(claims.userid, 42);
}

// ❌ Bad: Unclear name, multiple assertions, tightly coupled
#[test]
fn test_auth() {
    let token = generate_jwt_token(1, "u", "s").unwrap();
    assert!(token.len() > 0);
    assert!(validate_jwt_token(&token, "s").is_ok());
}
```

---

## Pull Request Process

### Before Creating PR

- [ ] All tests pass (backend + frontend)
- [ ] Code formatted (cargo fmt, npm run format)
- [ ] Code linted (cargo clippy, npm run lint)
- [ ] Constitutional compliance verified (see checklist below)
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or approved by maintainers)

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Fixes #<issue-number>

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Contract tests validated
- [ ] Manual testing completed

## Constitutional Compliance
- [ ] Contract-First Development (OpenAPI validated)
- [ ] Type Safety (strict mode, compile-time checks)
- [ ] TDD (tests written first)
- [ ] Atomic Transactions (if applicable)
- [ ] Real-Time Performance (<200ms)
- [ ] Security (JWT, CORS, parameterized queries)
- [ ] Audit Trail (metadata preserved)
- [ ] No Artificial Keys (composite keys used)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console warnings/errors
- [ ] Tested on 1280x1024 resolution (if UI changes)

## Screenshots (if applicable)
```

### PR Review Process

1. Create PR with descriptive title and body
2. Assign reviewers (at least 1 maintainer)
3. Address review comments
4. Update PR with requested changes
5. Re-request review after changes
6. Maintainer approves and merges

---

## Constitutional Compliance Checklist

All code MUST comply with these 8 principles:

### ✅ 1. Contract-First Development

- [ ] API endpoints match OpenAPI spec (`specs/001-i-have-an/contracts/openapi.yaml`)
- [ ] WebSocket messages match protocol spec (`specs/001-i-have-an/contracts/websocket.md`)
- [ ] Request/response schemas validated

### ✅ 2. Type Safety

- [ ] TypeScript strict mode enabled
- [ ] No `any` types (use proper types)
- [ ] Rust code compiles without warnings
- [ ] Proper error types used

### ✅ 3. TDD with Failing Tests

- [ ] Tests written BEFORE implementation
- [ ] Tests initially failed
- [ ] Tests now pass
- [ ] Contract tests validate OpenAPI compliance

### ✅ 4. Atomic Transactions

- [ ] Picking operations use 4-phase transaction
- [ ] Rollback logic implemented
- [ ] Database transactions properly scoped
- [ ] No partial data updates

### ✅ 5. Real-Time Performance

- [ ] WebSocket latency < 200ms
- [ ] API response time < 500ms
- [ ] UI updates use React concurrent features (useTransition)
- [ ] No blocking operations in UI

### ✅ 6. Security by Default

- [ ] JWT auth on protected endpoints
- [ ] CORS configured correctly
- [ ] Input validation implemented
- [ ] Parameterized SQL queries (no SQL injection)
- [ ] Secrets in environment variables (not code)

### ✅ 7. Audit Trail Preservation

- [ ] `ItemBatchStatus` preserved on unpick
- [ ] `PickingDate` never deleted
- [ ] `ModifiedBy` and `ModifiedDate` updated
- [ ] No deletion of audit records

### ✅ 8. No Artificial Keys

- [ ] Composite keys used (RunNo+RowNum+LineId)
- [ ] No auto-increment surrogate IDs
- [ ] WHERE clauses include ALL key columns
- [ ] Foreign keys reference composite keys

---

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code refactoring (no feature changes)
- `test`: Test additions/updates
- `chore`: Build/tooling changes

### Examples

**Good**:
```
feat(backend): add FEFO lot selection algorithm

Implement lot selection sorted by expiration date (DateExpiry ASC) with
TFC1 PARTIAL bin filtering. Algorithm returns 511 bins with available
quantity > 0.

Closes #42
```

**Good**:
```
fix(frontend): correct weight tolerance validation

Fix off-by-one error in weight tolerance calculation. Previously used
< instead of <=, causing valid weights to be rejected.

Fixes #58
```

**Bad**:
```
update stuff
```

**Bad**:
```
Fixed a bug
```

---

## Code Review Process

### For Reviewers

**Review Checklist**:
- [ ] Code follows style guidelines
- [ ] Tests are comprehensive and pass
- [ ] Constitutional principles verified
- [ ] No breaking changes (or approved)
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] Security best practices followed

**Review Comments**:
- Be constructive and respectful
- Explain WHY changes are needed
- Suggest alternatives when possible
- Approve when requirements met

### For Contributors

**Addressing Review Comments**:
- Address ALL comments (or explain why not)
- Push changes to same branch
- Re-request review after updates
- Thank reviewers for their time

---

## Development Tips

### Backend Development

```bash
# Watch mode (auto-rebuild on save)
cargo watch -x run

# Run specific test
cargo test test_name -- --nocapture

# Check for unused dependencies
cargo-udeps
```

### Frontend Development

```bash
# Dev server with HMR
npm run dev

# Type checking
npm run type-check

# Bundle analysis
npm run build -- --analyze
```

### Debugging

**Backend**:
```bash
RUST_LOG=debug cargo run
RUST_BACKTRACE=1 cargo test
```

**Frontend**:
```bash
# React DevTools (browser extension)
# Redux DevTools (if using Redux)
# Playwright debug mode
npm run test:e2e -- --debug
```

---

## Questions and Support

**Slack**: #partial-picking-dev
**Email**: dev-team@nwfth.com
**Documentation**: [docs/](./docs/)
**Issue Tracker**: [GitHub Issues]

---

## License

By contributing, you agree that your contributions will be licensed under the project's proprietary license.

---

**Thank you for contributing to the Partial Picking System! 🙏**

*Last Updated: 2025-10-07 | Version 1.0.0*
