# Research Document: Production-Ready Partial Picking System PWA

**Feature**: Production-Ready Partial Picking System PWA
**Branch**: `001-i-have-an`
**Date**: 2025-10-06
**Status**: Complete

---

## Overview

This document consolidates all technical research performed during Phase 0 planning for the production-ready Partial Picking System PWA. Each research area addresses a specific NEEDS CLARIFICATION item or technology choice identified in the Technical Context.

---

## 1. React 19 Concurrent Rendering for Real-Time Weight Updates

### Decision
Use React 19's **`useTransition`** and **`startTransition`** APIs to handle real-time WebSocket weight updates without blocking user interactions.

### Rationale
- **Problem**: Angular prototype had noticeable delay (~300-500ms) when displaying weight scale data
- **Root Cause**: Heavy re-renders blocked UI thread while processing weight updates
- **React 19 Solution**: Concurrent rendering allows marking weight updates as "non-urgent" transitions
- **Performance Gain**: Maintains 60fps UI while processing 10Hz weight data stream

### Implementation Pattern
```typescript
// hooks/useWeightScale.ts
import { useState, useTransition } from 'react';

export function useWeightScale(workstationId: string, scale: 'small' | 'big') {
  const [weight, setWeight] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/ws/scale/${scale}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Mark as non-urgent transition - won't block user clicks
      startTransition(() => {
        setWeight(data.weight);
      });
    };

    return () => ws.close();
  }, [scale]);

  return { weight, isPending };
}
```

### Alternatives Considered
- **Option A**: Debounce weight updates (300ms delay)
  - **Rejected**: Still feels laggy to users, doesn't solve root cause
- **Option B**: Use Web Workers for weight processing
  - **Rejected**: Overkill for simple JSON parsing, adds complexity
- **Option C**: Throttle to 30Hz instead of 10Hz
  - **Rejected**: Doesn't eliminate blocking, just reduces frequency

### References
- [React 19 Concurrent Features](https://react.dev/blog/2024/04/25/react-19#concurrent-rendering)
- [useTransition API Docs](https://react.dev/reference/react/useTransition)

---

## 2. Rust Axum with Tiberius for SQL Server Integration

### Decision
Use **Axum 0.7** web framework with **tiberius** crate for direct SQL Server access (no ORM).

### Rationale
- **Axum Benefits**:
  - Built on tokio (proven async runtime)
  - Tower middleware ecosystem (auth, logging, CORS)
  - Type-safe routing with minimal boilerplate
  - Excellent WebSocket support (future Phase 2 feature)

- **Tiberius Benefits**:
  - Native SQL Server protocol support (TDS)
  - Connection pooling via bb8-tiberius
  - Async/await compatible
  - No ORM abstraction leak - full control over queries

- **Why No ORM**:
  - Complex composite keys (RunNo, RowNum, LineId) hard to model in Diesel/SeaORM
  - 4-phase atomic transactions require precise SQL control
  - Production schema has non-standard conventions (User1-User12 fields)
  - Direct SQL allows optimization of FEFO queries

### Implementation Pattern
```rust
// db/connection.rs
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::{Client, Config};

pub async fn create_pool() -> Result<Pool<ConnectionManager>> {
    let mut config = Config::new();
    config.host(std::env::var("DATABASE_SERVER")?);
    config.port(std::env::var("DATABASE_PORT")?.parse()?);
    config.database(std::env::var("DATABASE_NAME")?);
    config.authentication(tiberius::AuthMethod::sql_server(
        std::env::var("DATABASE_USERNAME")?,
        std::env::var("DATABASE_PASSWORD")?
    ));

    let manager = ConnectionManager::new(config);
    Pool::builder().build(manager).await
}

// services/picking_service.rs
pub async fn save_picked_weight(
    pool: &Pool<ConnectionManager>,
    pick: PickRequest,
) -> Result<PickResponse> {
    let mut conn = pool.get().await?;
    let tx = conn.transaction().await?;

    // Phase 1: Insert Cust_PartialLotPicked
    tx.execute(
        "INSERT INTO Cust_PartialLotPicked (RunNo, RowNum, LineId, LotNo, BinNo, QtyIssued)
         VALUES (@P1, @P2, @P3, @P4, @P5, @P6)",
        &[&pick.run_no, &pick.row_num, &pick.line_id, &pick.lot_no, &pick.bin_no, &pick.weight]
    ).await?;

    // Phase 2: Update cust_PartialPicked.PickedPartialQty
    tx.execute(
        "UPDATE cust_PartialPicked
         SET PickedPartialQty = @P1, ItemBatchStatus = 'Allocated', ModifiedDate = GETDATE()
         WHERE RunNo = @P2 AND RowNum = @P3 AND LineId = @P4",
        &[&pick.weight, &pick.run_no, &pick.row_num, &pick.line_id]
    ).await?;

    // Phase 3: Insert LotTransaction
    tx.execute(
        "INSERT INTO LotTransaction (LotNo, ItemKey, TransactionType, QtyIssued, IssueDocNo, IssueDate)
         VALUES (@P1, @P2, 5, @P3, @P4, GETDATE())",
        &[&pick.lot_no, &pick.item_key, &pick.weight, &pick.batch_no]
    ).await?;

    // Phase 4: Increment LotMaster.QtyCommitSales
    tx.execute(
        "UPDATE LotMaster
         SET QtyCommitSales = QtyCommitSales + @P1
         WHERE LotNo = @P2 AND BinNo = @P3",
        &[&pick.weight, &pick.lot_no, &pick.bin_no]
    ).await?;

    tx.commit().await?;
    Ok(PickResponse { success: true })
}
```

### Alternatives Considered
- **Option A**: Diesel ORM
  - **Rejected**: Poor SQL Server support, complex composite key mapping
- **Option B**: SeaORM
  - **Rejected**: Runtime overhead for dynamic queries, overkill for simple CRUD
- **Option C**: sqlx with compile-time verification
  - **Rejected**: No SQL Server support, focused on PostgreSQL/MySQL

### References
- [Axum Documentation](https://docs.rs/axum/0.7.0/axum/)
- [Tiberius GitHub](https://github.com/prisma/tiberius)
- [bb8-tiberius Connection Pooling](https://github.com/bikeshedder/bb8-tiberius)

---

## 3. LDAP Authentication with Fallback to SQL

### Decision
Implement **dual authentication strategy**: Attempt LDAP first, fallback to SQL tbl_user on LDAP failure.

### Rationale
- **Business Requirement**: Support both Active Directory users and local SQL accounts
- **Reliability**: LDAP server may be unreachable (network issues, maintenance)
- **User Experience**: Seamless fallback prevents "cannot login" errors
- **Security**: JWT tokens consistent regardless of auth source

### Implementation Pattern
```rust
// services/auth_service.rs
use ldap3::{LdapConn, Scope, SearchEntry};

pub async fn authenticate(
    username: &str,
    password: &str,
    pool: &Pool<ConnectionManager>,
) -> Result<AuthResponse> {
    // Attempt 1: LDAP Authentication
    if std::env::var("ENABLE_LDAP_AUTH")? == "true" {
        match authenticate_ldap(username, password).await {
            Ok(user) => return Ok(create_auth_response(user)),
            Err(e) => {
                tracing::warn!("LDAP auth failed: {}, trying SQL fallback", e);
            }
        }
    }

    // Attempt 2: SQL Authentication
    if std::env::var("ENABLE_SQL_AUTH")? == "true" {
        match authenticate_sql(username, password, pool).await {
            Ok(user) => return Ok(create_auth_response(user)),
            Err(e) => {
                tracing::error!("SQL auth failed: {}", e);
                return Err(AuthError::InvalidCredentials);
            }
        }
    }

    Err(AuthError::NoAuthMethodEnabled)
}

async fn authenticate_ldap(username: &str, password: &str) -> Result<User> {
    let ldap_url = std::env::var("LDAP_URL")?;
    let base_dn = std::env::var("LDAP_BASE_DN")?;

    let mut ldap = LdapConn::new(&ldap_url)?;

    // Bind with service account
    ldap.simple_bind(&format!("CN={},CN=Users,{}", username, base_dn), password)?;

    // Search for user details
    let (rs, _res) = ldap
        .search(
            &base_dn,
            Scope::Subtree,
            &format!("(sAMAccountName={})", username),
            vec!["cn", "mail", "department"]
        )?
        .success()?;

    let entry = SearchEntry::construct(rs.into_iter().next().ok_or(AuthError::UserNotFound)?);

    Ok(User {
        username: username.to_string(),
        full_name: entry.attrs.get("cn").and_then(|v| v.first()).cloned(),
        email: entry.attrs.get("mail").and_then(|v| v.first()).cloned(),
        department: entry.attrs.get("department").and_then(|v| v.first()).cloned(),
        auth_source: "LDAP".to_string(),
    })
}

async fn authenticate_sql(
    username: &str,
    password: &str,
    pool: &Pool<ConnectionManager>,
) -> Result<User> {
    let mut conn = pool.get().await?;

    let row = conn.query(
        "SELECT userid, Fname, Lname, email, department, pword
         FROM tbl_user
         WHERE uname = @P1",
        &[&username]
    ).await?
    .into_row()
    .await?
    .ok_or(AuthError::UserNotFound)?;

    let stored_hash: &str = row.get(5).unwrap();

    // Verify password using bcrypt
    if !bcrypt::verify(password, stored_hash)? {
        return Err(AuthError::InvalidCredentials);
    }

    Ok(User {
        username: username.to_string(),
        full_name: format!("{} {}", row.get::<&str, _>(1).unwrap(), row.get::<&str, _>(2).unwrap()),
        email: row.get(3),
        department: row.get(4),
        auth_source: "SQL".to_string(),
    })
}

fn create_auth_response(user: User) -> AuthResponse {
    let claims = Claims {
        sub: user.username.clone(),
        exp: (Utc::now() + Duration::hours(168)).timestamp(),
        iat: Utc::now().timestamp(),
        iss: std::env::var("JWT_ISSUER").unwrap_or_default(),
    };

    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(std::env::var("JWT_SECRET")?.as_bytes())
    )?;

    AuthResponse {
        token,
        user,
        expires_in: 168 * 3600, // 168 hours in seconds
    }
}
```

### Alternatives Considered
- **Option A**: LDAP only, no fallback
  - **Rejected**: Single point of failure if LDAP server down
- **Option B**: SQL only with manual AD sync
  - **Rejected**: Requires ongoing sync process, password mismatches
- **Option C**: OAuth2/OIDC with Azure AD
  - **Rejected**: Requires internet access, complex setup for on-prem

### References
- [ldap3 Crate Documentation](https://docs.rs/ldap3/latest/ldap3/)
- [bcrypt for Rust](https://docs.rs/bcrypt/latest/bcrypt/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

## 4. WebSocket Protocol for Real-Time Weight Scale Data

### Decision
Use **native WebSocket** with JSON message protocol for bi-directional communication between frontend and .NET bridge service.

### Rationale
- **Real-Time Requirement**: <200ms latency for weight updates (HTTP polling would be 1-5s)
- **Bi-Directional**: Frontend can send commands (tare, zero, switch scale)
- **Efficiency**: Single persistent connection vs repeated HTTP requests
- **Browser Support**: Native WebSocket API available in all modern browsers

### Protocol Specification

**Message Format** (JSON):
```typescript
// Frontend → Bridge (Commands)
{
  "type": "command",
  "scale": "small" | "big",
  "action": "tare" | "zero" | "switch",
  "timestamp": 1704556800000
}

// Bridge → Frontend (Weight Data)
{
  "type": "weight",
  "scale": "small" | "big",
  "weight": 14.2450,
  "unit": "KG",
  "stable": true,
  "timestamp": 1704556800123
}

// Bridge → Frontend (Connection Status)
{
  "type": "status",
  "scale": "small" | "big",
  "connected": true,
  "error": null,
  "timestamp": 1704556800456
}

// Bridge → Frontend (Error)
{
  "type": "error",
  "scale": "small" | "big",
  "code": "SCALE_DISCONNECTED",
  "message": "Scale COM3 not responding",
  "timestamp": 1704556800789
}
```

**Connection Lifecycle**:
1. **Frontend Initiates**: `ws://localhost:5000/ws/scale/small`
2. **Bridge Authenticates**: Verify workstation ID from query param
3. **Bridge Opens Serial Port**: COM port for specified scale
4. **Continuous Streaming**: Bridge sends weight data at 10Hz (100ms intervals)
5. **Heartbeat**: Ping/Pong every 30s to detect dead connections
6. **Graceful Close**: Frontend sends close frame, bridge closes serial port

### Implementation Pattern

**Frontend (TypeScript)**:
```typescript
// services/websocket.ts
export class WeightScaleWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private scale: 'small' | 'big',
    private onWeight: (data: WeightData) => void,
    private onStatus: (data: StatusData) => void,
    private onError: (error: ErrorData) => void
  ) {}

  connect() {
    const url = `${import.meta.env.VITE_BRIDGE_URL}/ws/scale/${this.scale}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log(`WebSocket connected: ${this.scale} scale`);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'weight':
          this.onWeight(message);
          break;
        case 'status':
          this.onStatus(message);
          break;
        case 'error':
          this.onError(message);
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.attemptReconnect();
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.attemptReconnect();
    };
  }

  sendCommand(action: 'tare' | 'zero' | 'switch') {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'command',
        scale: this.scale,
        action,
        timestamp: Date.now()
      }));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      this.onError({
        type: 'error',
        code: 'MAX_RECONNECT_EXCEEDED',
        message: 'Failed to reconnect after 5 attempts',
        scale: this.scale,
        timestamp: Date.now()
      });
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
```

**Bridge Service (C#)**:
```csharp
// Services/WebSocketService.cs
using System.Net.WebSockets;
using System.IO.Ports;

public class WebSocketService
{
    private readonly SerialPortService _serialPort;

    public async Task HandleWeightScaleConnection(
        WebSocket webSocket,
        string scale,
        CancellationToken cancellationToken
    )
    {
        var comPort = scale == "small" ? "COM3" : "COM4";
        _serialPort.Open(comPort, 9600);

        var buffer = new byte[1024];

        // Start continuous weight reading
        var readTask = ReadWeightContinuously(webSocket, comPort, cancellationToken);

        // Handle incoming commands
        while (webSocket.State == WebSocketState.Open)
        {
            var result = await webSocket.ReceiveAsync(
                new ArraySegment<byte>(buffer),
                cancellationToken
            );

            if (result.MessageType == WebSocketMessageType.Close)
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Client closed connection",
                    cancellationToken
                );
                break;
            }

            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            var command = JsonSerializer.Deserialize<CommandMessage>(message);

            await HandleCommand(command, comPort);
        }

        _serialPort.Close(comPort);
    }

    private async Task ReadWeightContinuously(
        WebSocket webSocket,
        string comPort,
        CancellationToken cancellationToken
    )
    {
        while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            try
            {
                var weight = await _serialPort.ReadWeightAsync(comPort);

                var message = new WeightMessage
                {
                    Type = "weight",
                    Scale = comPort == "COM3" ? "small" : "big",
                    Weight = weight.Value,
                    Unit = "KG",
                    Stable = weight.IsStable,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };

                var json = JsonSerializer.Serialize(message);
                var bytes = Encoding.UTF8.GetBytes(json);

                await webSocket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    cancellationToken
                );

                await Task.Delay(100, cancellationToken); // 10Hz polling
            }
            catch (Exception ex)
            {
                var errorMessage = new ErrorMessage
                {
                    Type = "error",
                    Scale = comPort == "COM3" ? "small" : "big",
                    Code = "SCALE_READ_ERROR",
                    Message = ex.Message,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };

                var errorJson = JsonSerializer.Serialize(errorMessage);
                var errorBytes = Encoding.UTF8.GetBytes(errorJson);

                await webSocket.SendAsync(
                    new ArraySegment<byte>(errorBytes),
                    WebSocketMessageType.Text,
                    true,
                    cancellationToken
                );
            }
        }
    }

    private async Task HandleCommand(CommandMessage command, string comPort)
    {
        switch (command.Action)
        {
            case "tare":
                await _serialPort.SendCommandAsync(comPort, "T");
                break;
            case "zero":
                await _serialPort.SendCommandAsync(comPort, "Z");
                break;
            case "switch":
                // Handled by frontend closing connection and opening new one
                break;
        }
    }
}
```

### Alternatives Considered
- **Option A**: HTTP Long Polling
  - **Rejected**: Higher latency (1-5s), more server overhead
- **Option B**: Server-Sent Events (SSE)
  - **Rejected**: Uni-directional only, can't send commands to bridge
- **Option C**: gRPC Streaming
  - **Rejected**: Overkill for simple use case, requires HTTP/2, complex browser setup

### References
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [.NET WebSocket Server](https://learn.microsoft.com/en-us/dotnet/api/system.net.websockets.websocket)
- [WebSocket Best Practices](https://www.rfc-editor.org/rfc/rfc6455)

---

## 5. Tailwind CSS + shadcn/ui for Component Library

### Decision
Use **Tailwind CSS** utility-first framework with **shadcn/ui** as the base component library, customized with NWFTH brand theme.

### Rationale
- **Tailwind Benefits**:
  - Utility-first prevents style bloat
  - PurgeCSS eliminates unused styles in production
  - JIT compiler for fast development
  - Responsive modifiers (sm:, md:, lg:)
  - Dark mode support (future Phase 2)

- **shadcn/ui Benefits**:
  - Copy-paste components (not npm dependency)
  - Full control over component code
  - Built with Radix UI primitives (accessibility)
  - TypeScript-first design
  - Tailwind-compatible styling

- **NWFTH Customization**:
  - Brand colors: #523325 (brown), #F0B429 (amber), #F5F5DC (cream)
  - Custom screens: 1280px (warehouse tablet)
  - Monospace fonts for numeric displays

### Implementation Pattern

**Tailwind Config**:
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'nwfth-brown': '#523325',
        'nwfth-amber': '#F0B429',
        'nwfth-cream': '#F5F5DC',
        'nwfth-text-dark': '#3F220D',
        'nwfth-text-medium': '#6B4423',
      },
      screens: {
        'warehouse': '1280px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'weight-display': ['48px', { lineHeight: '56px', fontWeight: '700' }],
        'numeric': ['20px', { lineHeight: '28px', fontWeight: '500' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
};
```

**shadcn/ui Setup**:
```bash
# Install shadcn/ui CLI
npx shadcn-ui@latest init

# Add components as needed
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add progress
```

**Custom Component Example**:
```typescript
// components/ui/button.tsx (shadcn/ui base)
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-nwfth-amber text-white hover:bg-nwfth-amber/90",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border-2 border-nwfth-brown text-nwfth-brown hover:bg-nwfth-cream",
        secondary: "bg-gray-200 text-nwfth-text-dark hover:bg-gray-300",
        ghost: "hover:bg-nwfth-cream",
        link: "text-nwfth-amber underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Alternatives Considered
- **Option A**: Material-UI (MUI)
  - **Rejected**: Heavy bundle size (200KB+), opinionated design system
- **Option B**: Ant Design
  - **Rejected**: Chinese-centric design, hard to customize
- **Option C**: Chakra UI
  - **Rejected**: Runtime style injection, performance overhead

### References
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)

---

## 6. Service Worker for Offline PWA Capability

### Decision
Implement **Workbox-powered Service Worker** for offline caching with runtime caching strategies.

### Rationale
- **PWA Requirement**: Must function offline for last 5 runs
- **Cache Strategy**:
  - Static assets: Cache-first (HTML, CSS, JS)
  - API data: Network-first with fallback (runs, items)
  - Weight data: Network-only (real-time required)
- **Workbox Benefits**: Pre-configured strategies, automatic cache versioning, easy debugging

### Implementation Pattern

**Service Worker Registration**:
```typescript
// src/main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}
```

**Workbox Configuration**:
```javascript
// public/sw.js (generated by workbox-webpack-plugin)
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache static assets (HTML, CSS, JS, images)
precacheAndRoute(self.__WB_MANIFEST);

// Cache Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache API responses (runs, items, lots)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Skip WebSocket connections (always network)
registerRoute(
  ({ url }) => url.protocol === 'ws:' || url.protocol === 'wss:',
  new NetworkFirst({
    networkTimeoutSeconds: 3,
  })
);
```

**Vite PWA Plugin**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'assets/images/*.webp'],
      manifest: {
        name: 'Partial Picking System',
        short_name: 'Picking',
        description: 'NWFTH Warehouse Partial Picking System',
        theme_color: '#523325',
        background_color: '#F5F5DC',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^http:\/\/localhost:7075\/api\/(runs|items|lots)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ]
});
```

### Alternatives Considered
- **Option A**: Manual Service Worker without Workbox
  - **Rejected**: Too much boilerplate, error-prone cache management
- **Option B**: Next.js PWA plugin
  - **Rejected**: Requires Next.js framework (we're using Vite + React)
- **Option C**: IndexedDB for offline storage
  - **Rejected**: Overkill for simple offline caching, adds complexity

### References
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [PWA Best Practices](https://web.dev/pwa-checklist/)

---

## 7. FEFO Algorithm Implementation

### Decision
Implement **server-side FEFO (First Expired, First Out)** algorithm in Rust backend with client-side enforcement.

### Rationale
- **Business Critical**: FEFO compliance is non-negotiable per constitution
- **Data Integrity**: Server-side prevents bypassing via client manipulation
- **Performance**: Pre-sorted lot list reduces frontend processing
- **Audit Trail**: Server logs FEFO decisions for compliance reporting

### Algorithm Specification

**SQL Query (Rust backend)**:
```sql
SELECT
    l.LotNo,
    l.BinNo,
    l.DateExpiry,
    l.LocationKey,
    (l.QtyOnHand - l.QtyCommitSales) AS AvailableQty
FROM LotMaster l
WHERE
    l.ItemKey = @ItemKey
    AND l.LocationKey = 'TFC1'
    AND l.User1 = 'WHTFC1'
    AND l.User4 = 'PARTIAL'
    AND (l.QtyOnHand - l.QtyCommitSales) > 0
ORDER BY
    l.DateExpiry ASC,      -- First: Earliest expiry date
    l.LocationKey ASC,     -- Second: Location alphabetically
    l.BinNo ASC            -- Third: Bin number alphabetically
LIMIT 1;                   -- Return ONLY the FEFO-compliant lot
```

**Rust Implementation**:
```rust
// services/lot_service.rs
use chrono::NaiveDate;

#[derive(Debug, Clone)]
pub struct FefoLot {
    pub lot_no: String,
    pub bin_no: String,
    pub date_expiry: NaiveDate,
    pub location_key: String,
    pub available_qty: f64,
}

pub async fn get_fefo_lot_for_item(
    pool: &Pool<ConnectionManager>,
    item_key: &str,
) -> Result<FefoLot> {
    let mut conn = pool.get().await?;

    let row = conn.query(
        r#"
        SELECT
            l.LotNo,
            l.BinNo,
            l.DateExpiry,
            l.LocationKey,
            (l.QtyOnHand - l.QtyCommitSales) AS AvailableQty
        FROM LotMaster l
        WHERE
            l.ItemKey = @P1
            AND l.LocationKey = 'TFC1'
            AND (SELECT User1 FROM BinMaster WHERE BinNo = l.BinNo) = 'WHTFC1'
            AND (SELECT User4 FROM BinMaster WHERE BinNo = l.BinNo) = 'PARTIAL'
            AND (l.QtyOnHand - l.QtyCommitSales) > 0
        ORDER BY
            l.DateExpiry ASC,
            l.LocationKey ASC,
            l.BinNo ASC
        "#,
        &[&item_key]
    ).await?
    .into_row()
    .await?
    .ok_or_else(|| AppError::NotFound(format!("No available lots for item {}", item_key)))?;

    Ok(FefoLot {
        lot_no: row.get(0).unwrap(),
        bin_no: row.get(1).unwrap(),
        date_expiry: row.get(2).unwrap(),
        location_key: row.get(3).unwrap(),
        available_qty: row.get(4).unwrap(),
    })
}
```

**Frontend Validation**:
```typescript
// utils/fefo.ts
export function validateFefoCompliance(
  selectedLot: Lot,
  availableLots: Lot[]
): { compliant: boolean; message?: string } {
  // Sort lots by FEFO rules
  const sortedLots = [...availableLots].sort((a, b) => {
    const dateCompare = new Date(a.dateExpiry).getTime() - new Date(b.dateExpiry).getTime();
    if (dateCompare !== 0) return dateCompare;

    const locationCompare = a.locationKey.localeCompare(b.locationKey);
    if (locationCompare !== 0) return locationCompare;

    return a.binNo.localeCompare(b.binNo);
  });

  const fefoLot = sortedLots[0];

  if (selectedLot.lotNo !== fefoLot.lotNo || selectedLot.binNo !== fefoLot.binNo) {
    return {
      compliant: false,
      message: `FEFO violation: Must use Lot ${fefoLot.lotNo} in Bin ${fefoLot.binNo} (expires ${format(new Date(fefoLot.dateExpiry), 'yyyy-MM-dd')})`
    };
  }

  return { compliant: true };
}
```

### Alternatives Considered
- **Option A**: Client-side FEFO only
  - **Rejected**: Bypassable via client manipulation
- **Option B**: All lots returned, frontend sorts
  - **Rejected**: Wastes bandwidth, exposes unnecessary data
- **Option C**: FEFO in stored procedure
  - **Rejected**: Harder to test, less flexible for algorithm changes

### References
- [FEFO Inventory Management](https://www.supplychainbrain.com/articles/32441-first-expired-first-out-fefo-inventory-management)
- Constitution v1.0.0 Section II: FEFO Compliance

---

## 8. Error Handling Strategy

### Decision
Implement **structured error handling** with specific error codes, user-facing messages, and correlation IDs for tracing.

### Rationale
- **User Experience**: Clear, actionable error messages (per user requirement: "simple, user-friendly")
- **Debugging**: Correlation IDs link frontend errors to backend logs
- **Monitoring**: Structured errors enable alerting on specific failure types
- **Internationalization**: Error codes allow future translation support

### Error Code Taxonomy

**Format**: `CATEGORY_SPECIFIC_ERROR` (e.g., `AUTH_INVALID_CREDENTIALS`, `DB_CONNECTION_FAILED`)

**Categories**:
- `AUTH_*`: Authentication/authorization errors
- `DB_*`: Database connection/query errors
- `VALIDATION_*`: Input validation errors
- `BUSINESS_*`: Business logic violations (e.g., FEFO, weight tolerance)
- `HARDWARE_*`: Scale/printer hardware errors
- `NETWORK_*`: WebSocket/HTTP network errors

### Implementation Pattern

**Backend (Rust)**:
```rust
// utils/errors.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub error_code: String,
    pub message: String,
    pub user_message: String,
    pub correlation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug)]
pub enum AppError {
    // Authentication errors
    InvalidCredentials,
    LdapConnectionFailed(String),
    JwtExpired,
    Unauthorized,

    // Database errors
    DatabaseConnectionFailed(String),
    QueryExecutionFailed(String),
    TransactionRollbackFailed(String),

    // Validation errors
    WeightOutOfTolerance { actual: f64, min: f64, max: f64 },
    InvalidItemKey(String),
    InvalidRunNo(i32),

    // Business logic errors
    FefoViolation { expected_lot: String, provided_lot: String },
    InsufficientInventory { item_key: String, required: f64, available: f64 },

    // Hardware errors
    ScaleDisconnected,
    PrinterOffline,

    // Generic errors
    NotFound(String),
    InternalServerError(String),
}

impl AppError {
    fn error_code(&self) -> &'static str {
        match self {
            AppError::InvalidCredentials => "AUTH_INVALID_CREDENTIALS",
            AppError::LdapConnectionFailed(_) => "AUTH_LDAP_CONNECTION_FAILED",
            AppError::JwtExpired => "AUTH_JWT_EXPIRED",
            AppError::Unauthorized => "AUTH_UNAUTHORIZED",
            AppError::DatabaseConnectionFailed(_) => "DB_CONNECTION_FAILED",
            AppError::QueryExecutionFailed(_) => "DB_QUERY_FAILED",
            AppError::TransactionRollbackFailed(_) => "DB_TRANSACTION_ROLLBACK_FAILED",
            AppError::WeightOutOfTolerance { .. } => "VALIDATION_WEIGHT_OUT_OF_TOLERANCE",
            AppError::InvalidItemKey(_) => "VALIDATION_INVALID_ITEM_KEY",
            AppError::InvalidRunNo(_) => "VALIDATION_INVALID_RUN_NO",
            AppError::FefoViolation { .. } => "BUSINESS_FEFO_VIOLATION",
            AppError::InsufficientInventory { .. } => "BUSINESS_INSUFFICIENT_INVENTORY",
            AppError::ScaleDisconnected => "HARDWARE_SCALE_DISCONNECTED",
            AppError::PrinterOffline => "HARDWARE_PRINTER_OFFLINE",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::InternalServerError(_) => "INTERNAL_SERVER_ERROR",
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            AppError::InvalidCredentials | AppError::Unauthorized | AppError::JwtExpired => StatusCode::UNAUTHORIZED,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::WeightOutOfTolerance { .. } | AppError::InvalidItemKey(_) | AppError::InvalidRunNo(_) => StatusCode::BAD_REQUEST,
            AppError::FefoViolation { .. } | AppError::InsufficientInventory { .. } => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn user_message(&self) -> String {
        match self {
            AppError::InvalidCredentials => "Invalid username or password".to_string(),
            AppError::LdapConnectionFailed(_) => "Cannot connect to authentication server. Try again later.".to_string(),
            AppError::JwtExpired => "Session expired. Please log in again.".to_string(),
            AppError::Unauthorized => "Access denied".to_string(),
            AppError::DatabaseConnectionFailed(_) => "Database unavailable. Contact IT support.".to_string(),
            AppError::QueryExecutionFailed(_) => "Database error. Try again.".to_string(),
            AppError::TransactionRollbackFailed(_) => "Save failed. Please retry.".to_string(),
            AppError::WeightOutOfTolerance { min, max, .. } => format!("Weight must be {:.3} - {:.3} KG", min, max),
            AppError::InvalidItemKey(key) => format!("Item {} not found", key),
            AppError::InvalidRunNo(run_no) => format!("Run {} not found", run_no),
            AppError::FefoViolation { expected_lot, .. } => format!("Must use Lot {} (FEFO rule)", expected_lot),
            AppError::InsufficientInventory { item_key, available, .. } => format!("Only {:.2} KG available for {}", available, item_key),
            AppError::ScaleDisconnected => "Scale not connected. Check cable.".to_string(),
            AppError::PrinterOffline => "Printer offline. Check power and connection.".to_string(),
            AppError::NotFound(msg) => msg.clone(),
            AppError::InternalServerError(_) => "System error. Contact support.".to_string(),
        }
    }

    fn technical_message(&self) -> String {
        match self {
            AppError::LdapConnectionFailed(msg) => msg.clone(),
            AppError::DatabaseConnectionFailed(msg) => msg.clone(),
            AppError::QueryExecutionFailed(msg) => msg.clone(),
            AppError::TransactionRollbackFailed(msg) => msg.clone(),
            AppError::InternalServerError(msg) => msg.clone(),
            _ => self.user_message(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let correlation_id = Uuid::new_v4().to_string();

        tracing::error!(
            correlation_id = %correlation_id,
            error_code = %self.error_code(),
            technical_message = %self.technical_message(),
            "Application error occurred"
        );

        let error_response = ErrorResponse {
            error_code: self.error_code().to_string(),
            message: self.technical_message(),
            user_message: self.user_message(),
            correlation_id,
            details: match &self {
                AppError::WeightOutOfTolerance { actual, min, max } => Some(serde_json::json!({
                    "actual": actual,
                    "min": min,
                    "max": max
                })),
                _ => None,
            },
        };

        (self.status_code(), Json(error_response)).into_response()
    }
}
```

**Frontend (TypeScript)**:
```typescript
// services/api/client.ts
export interface ApiError {
  error_code: string;
  message: string;
  user_message: string;
  correlation_id: string;
  details?: Record<string, any>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json();

      // Log to monitoring service
      console.error('[API Error]', {
        code: error.error_code,
        correlation_id: error.correlation_id,
        message: error.message,
      });

      throw new ApiErrorException(error);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('pk_auth_token')}`,
      },
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('pk_auth_token')}`,
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }
}

export class ApiErrorException extends Error {
  constructor(public apiError: ApiError) {
    super(apiError.user_message);
    this.name = 'ApiErrorException';
  }
}

// Usage in component
try {
  await apiClient.post('/api/picks', pickData);
} catch (error) {
  if (error instanceof ApiErrorException) {
    // Show user-friendly message
    toast.error(error.apiError.user_message);

    // Log correlation ID for support
    console.error(`Error ID: ${error.apiError.correlation_id}`);
  } else {
    toast.error('Unexpected error occurred');
  }
}
```

### Alternatives Considered
- **Option A**: Generic HTTP status codes only
  - **Rejected**: Not specific enough for debugging
- **Option B**: Stack traces in error responses
  - **Rejected**: Security risk, exposes internal structure
- **Option C**: All errors return 200 OK with error object
  - **Rejected**: Violates HTTP semantics, breaks tooling

### References
- [REST API Error Handling Best Practices](https://www.rfc-editor.org/rfc/rfc7807)
- [Correlation IDs for Distributed Tracing](https://www.w3.org/TR/trace-context/)

---

## Summary

All research tasks have been completed and documented. Key decisions made:

1. **React 19 Concurrent Rendering** - Eliminates Angular prototype's weight update lag
2. **Rust Axum + Tiberius** - Direct SQL control for complex transactions
3. **Dual LDAP/SQL Authentication** - Reliable failover mechanism
4. **WebSocket Protocol** - Sub-200ms real-time weight data
5. **Tailwind CSS + shadcn/ui** - Customizable, accessible component library
6. **Workbox Service Worker** - Offline capability for last 5 runs
7. **Server-Side FEFO** - Non-bypassable compliance enforcement
8. **Structured Error Handling** - User-friendly messages with correlation IDs

All **NEEDS CLARIFICATION** items from Technical Context have been resolved. Ready to proceed to Phase 1 (Design & Contracts).

---

**Document Version**: 1.0
**Based on**: Constitution v1.0.0, Feature Spec v1.0, Database Schema v2.5
**Ready for**: Phase 1 Design & Contracts
