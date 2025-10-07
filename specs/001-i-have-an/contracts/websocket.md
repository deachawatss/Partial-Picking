# WebSocket Protocol Specification
## Real-Time Weight Scale Integration

**Feature Branch**: `001-i-have-an`
**Created**: 2025-10-06
**Protocol Version**: 1.0
**Bridge Service**: **Existing implementation** at `Weight-scale/bridge-service/` (no modifications needed)

---

## Overview

This document specifies the WebSocket protocol for real-time weight scale data streaming from the **existing** .NET 8 bridge service to the React 19 PWA frontend. The bridge service is already implemented and working with the Angular prototype - it uses standard WebSocket protocol and is framework-agnostic (works with React, Angular, Vue, vanilla JS, etc.).

**Architecture**:
```
┌──────────────────┐    Serial    ┌──────────────────┐   WebSocket   ┌──────────────────┐
│  Weight Scale    │──────────────>│  .NET 8 Bridge   │<─────────────>│  React 19 PWA    │
│  (COM Port)      │   RS-232/USB  │  Service         │   ws://...    │  Frontend        │
└──────────────────┘               └──────────────────┘               └──────────────────┘
     Hardware                        Port 5000                         Port 6060
```

**Key Requirements**:
- Latency: <200ms from scale reading to UI update
- Continuous mode: 100ms polling interval (configurable via .env: WEIGHT_POLLING_INTERVAL_MS)
- Concurrent rendering: React 19 `useTransition` for non-blocking updates
- Dual scale support: SMALL and BIG scales per workstation
- Offline handling: Graceful degradation when scale/bridge unavailable

---

## Connection Endpoints

### Base URL

**Development**:
```
ws://localhost:5000/ws
```

**Production** (Warehouse Network):
```
ws://192.168.0.86:5000/ws
```

Configurable via `.env`:
```bash
BRIDGE_SERVICE_PORT=5000
```

### Scale WebSocket Endpoints

#### Connect to Scale by Type

**Endpoint** (from existing bridge service):
```
ws://{host}:{port}/ws/scale/{scaleType}
```

**Parameters**:
- `{scaleType}`: Scale type (`small` or `big`)

**Examples**:
```
ws://localhost:5000/ws/scale/small
ws://localhost:5000/ws/scale/big
ws://192.168.0.86:5000/ws/scale/small
```

**Note**: The existing bridge service uses simplified endpoints without workstation ID. Each bridge service instance is deployed per workstation, so the workstation context is implicit based on which machine the bridge runs on.

**Connection Flow**:
1. Frontend connects to bridge service WebSocket endpoint: `ws://localhost:5000/ws/scale/small` or `/big`
2. Existing bridge service accepts WebSocket handshake
3. Bridge service automatically reads from configured COM port (per appsettings.json or environment variables)
4. Bridge service broadcasts weight updates to all connected clients
5. Frontend receives messages and updates UI using React 19 `useTransition` for non-blocking rendering

**Important**: The existing bridge service is already configured with scale COM ports and handles serial communication. No changes needed to bridge code - React frontend simply connects and listens.

---

## Message Protocol

### Client → Server Messages

#### 1. Ping (Heartbeat)

**Purpose**: Keep connection alive and verify bridge service is responsive

**Message Format**:
```json
{
  "type": "ping",
  "timestamp": "2025-10-06T10:15:30.123Z"
}
```

**Server Response**:
```json
{
  "type": "pong",
  "timestamp": "2025-10-06T10:15:30.125Z",
  "serverTime": "2025-10-06T10:15:30.125Z"
}
```

**Frequency**: Every 30 seconds (client-side configurable)

---

#### 2. Request Current Weight

**Purpose**: Request immediate weight reading (on-demand, not continuous)

**Message Format**:
```json
{
  "type": "requestWeight",
  "timestamp": "2025-10-06T10:15:30.123Z"
}
```

**Server Response**: Same as `weightUpdate` message (see below)

---

#### 3. Start Continuous Mode

**Purpose**: Request continuous weight streaming at polling interval

**Message Format**:
```json
{
  "type": "startContinuous",
  "pollingIntervalMs": 100,
  "timestamp": "2025-10-06T10:15:30.123Z"
}
```

**Fields**:
- `pollingIntervalMs` (optional): Override default polling interval (default: 100ms from .env)

**Server Response**:
```json
{
  "type": "continuousStarted",
  "pollingIntervalMs": 100,
  "scaleId": "SCALE-SMALL-01",
  "comPort": "COM3",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

**Notes**:
- Continuous mode starts automatically on connection if `SCALE_CONTINUOUS_MODE=true` in .env
- Multiple clients can connect to same scale (broadcast mode)

---

#### 4. Stop Continuous Mode

**Purpose**: Stop continuous weight streaming

**Message Format**:
```json
{
  "type": "stopContinuous",
  "timestamp": "2025-10-06T10:15:30.123Z"
}
```

**Server Response**:
```json
{
  "type": "continuousStopped",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

---

### Server → Client Messages

#### 1. Weight Update (Continuous Stream)

**Purpose**: Real-time weight data from scale

**Message Format**:
```json
{
  "type": "weightUpdate",
  "weight": 20.025,
  "unit": "KG",
  "stable": true,
  "scaleId": "SCALE-SMALL-01",
  "scaleType": "SMALL",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

**Fields**:
- `weight` (number): Current weight reading from scale (decimal)
- `unit` (string): Unit of measure (always "KG" for this project)
- `stable` (boolean): Weight is stable (not fluctuating)
  - `true`: Weight stable for > 1 second (ready to save)
  - `false`: Weight still fluctuating (operator still placing item)
- `scaleId` (string): Scale identifier (from TFC_Weightscale2)
- `scaleType` (enum): "SMALL" or "BIG"
- `timestamp` (ISO 8601): Server timestamp when reading was captured

**Frequency**: Every 100ms (configurable via WEIGHT_POLLING_INTERVAL_MS)

**Example Sequence**:
```json
// User starts placing item on scale
{ "type": "weightUpdate", "weight": 5.234, "stable": false, "timestamp": "2025-10-06T10:15:30.100Z" }
{ "type": "weightUpdate", "weight": 12.567, "stable": false, "timestamp": "2025-10-06T10:15:30.200Z" }
{ "type": "weightUpdate", "weight": 18.901, "stable": false, "timestamp": "2025-10-06T10:15:30.300Z" }
{ "type": "weightUpdate", "weight": 20.012, "stable": false, "timestamp": "2025-10-06T10:15:30.400Z" }

// Weight stabilizes
{ "type": "weightUpdate", "weight": 20.025, "stable": true, "timestamp": "2025-10-06T10:15:30.500Z" }
{ "type": "weightUpdate", "weight": 20.025, "stable": true, "timestamp": "2025-10-06T10:15:30.600Z" }
{ "type": "weightUpdate", "weight": 20.025, "stable": true, "timestamp": "2025-10-06T10:15:30.700Z" }
```

---

#### 2. Scale Offline

**Purpose**: Notify client that scale hardware is disconnected

**Message Format**:
```json
{
  "type": "scaleOffline",
  "scaleId": "SCALE-SMALL-01",
  "reason": "COM port not responding",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

**Fields**:
- `scaleId` (string): Scale identifier
- `reason` (string): Human-readable offline reason
- `timestamp` (ISO 8601): When offline was detected

**Client Behavior**:
- Display offline indicator in UI
- Disable weight-dependent operations (picking, weight validation)
- Attempt reconnection every 5 seconds
- Show notification: "Scale offline - reconnecting..."

---

#### 3. Scale Online

**Purpose**: Notify client that scale hardware is reconnected

**Message Format**:
```json
{
  "type": "scaleOnline",
  "scaleId": "SCALE-SMALL-01",
  "comPort": "COM3",
  "timestamp": "2025-10-06T10:15:35.250Z"
}
```

**Fields**:
- `scaleId` (string): Scale identifier
- `comPort` (string): COM port reconnected
- `timestamp` (ISO 8601): When online was detected

**Client Behavior**:
- Remove offline indicator
- Re-enable weight-dependent operations
- Automatically resume continuous mode
- Show notification: "Scale reconnected"

---

#### 4. Error

**Purpose**: Notify client of bridge service errors

**Message Format**:
```json
{
  "type": "error",
  "code": "HARDWARE_SCALE_READ_FAILED",
  "message": "Failed to read weight from COM3",
  "scaleId": "SCALE-SMALL-01",
  "timestamp": "2025-10-06T10:15:30.125Z",
  "details": {
    "comPort": "COM3",
    "errorType": "TimeoutException",
    "retryCount": 3
  }
}
```

**Error Codes**:
- `HARDWARE_SCALE_READ_FAILED`: Scale read timeout or error
- `HARDWARE_COM_PORT_UNAVAILABLE`: COM port in use or not found
- `HARDWARE_SCALE_NOT_CONFIGURED`: Scale not found in TFC_Weightscale2 table
- `BRIDGE_SERVICE_OVERLOAD`: Bridge service CPU/memory limits exceeded

**Client Behavior**:
- Log error with correlation ID
- Display user-friendly error message
- Attempt recovery (reconnect, fallback scale, etc.)

---

## Connection Lifecycle

### 1. Connection Establishment

```typescript
// Frontend (React Hook)
export function useWeightScale(workstationId: string, scaleType: 'small' | 'big') {
  const [weight, setWeight] = useState(0);
  const [stable, setStable] = useState(false);
  const [online, setOnline] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const bridgeUrl = import.meta.env.VITE_BRIDGE_SERVICE_URL || 'ws://localhost:5000';
    const ws = new WebSocket(`${bridgeUrl}/ws/scale/${workstationId}/${scaleType}`);

    ws.onopen = () => {
      console.log(`Connected to ${scaleType} scale for ${workstationId}`);
      setOnline(true);

      // Start continuous mode (if not auto-started by server)
      ws.send(JSON.stringify({
        type: 'startContinuous',
        pollingIntervalMs: 100,
        timestamp: new Date().toISOString()
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'weightUpdate') {
        // Use React 19 concurrent rendering for non-blocking updates
        startTransition(() => {
          setWeight(data.weight);
          setStable(data.stable);
        });
      } else if (data.type === 'scaleOffline') {
        setOnline(false);
      } else if (data.type === 'scaleOnline') {
        setOnline(true);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setOnline(false);
    };

    ws.onclose = () => {
      console.log(`Disconnected from ${scaleType} scale`);
      setOnline(false);
    };

    return () => {
      ws.close();
    };
  }, [workstationId, scaleType]);

  return { weight, stable, online, isPending };
}
```

---

### 2. Heartbeat / Keep-Alive

**Client Ping Interval**: 30 seconds

```typescript
// Frontend ping timer
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    }));
  }
}, 30000);
```

**Server Pong Timeout**: 60 seconds (if no pong received, disconnect)

---

### 3. Reconnection Strategy

**Client-Side Reconnection**:
```typescript
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectDelay = 5000; // 5 seconds

function reconnect() {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`Reconnecting... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

    setTimeout(() => {
      // Attempt reconnection
      ws = new WebSocket(`${bridgeUrl}/ws/scale/${workstationId}/${scaleType}`);
      // ... (same onopen, onmessage handlers)
    }, reconnectDelay);
  } else {
    console.error('Max reconnection attempts reached');
    // Display persistent error to user
  }
}

ws.onclose = () => {
  setOnline(false);
  reconnect();
};
```

---

## Weight Validation Flow

### Tolerance Range Validation

**Frontend Logic**:
```typescript
interface WeightValidation {
  weight: number;
  targetQty: number;
  toleranceKG: number;
  weightRangeLow: number;
  weightRangeHigh: number;
  isValid: boolean;
}

function validateWeight(
  scaleWeight: number,
  targetQty: number,
  toleranceKG: number
): WeightValidation {
  const weightRangeLow = targetQty - toleranceKG;
  const weightRangeHigh = targetQty + toleranceKG;
  const isValid = scaleWeight >= weightRangeLow && scaleWeight <= weightRangeHigh;

  return {
    weight: scaleWeight,
    targetQty,
    toleranceKG,
    weightRangeLow,
    weightRangeHigh,
    isValid
  };
}

// Usage in component
const { weight, stable, online } = useWeightScale(workstationId, 'small');
const validation = validateWeight(weight, item.totalNeeded, item.toleranceKG);

// Enable "Add Lot" button only when valid
const canSave = online && stable && validation.isValid;
```

**Visual Feedback**:
```typescript
// Color coding based on weight range
function getWeightStatusColor(validation: WeightValidation): string {
  if (!validation.isValid) return 'red';    // Out of tolerance
  if (validation.weight < validation.targetQty) return 'yellow'; // Under target
  return 'green';                            // Within tolerance
}
```

---

## Error Handling

### 1. Connection Errors

**Scenario**: Bridge service unreachable

**Client Behavior**:
```typescript
ws.onerror = (error) => {
  console.error('WebSocket connection error:', error);

  // Display user-friendly error
  showNotification({
    type: 'error',
    message: 'Cannot connect to weight scale service. Please check network connection.',
    action: 'Retry',
    onAction: () => reconnect()
  });

  // Disable weight operations
  setOnline(false);
};
```

---

### 2. Scale Hardware Errors

**Scenario**: COM port failure, scale disconnected

**Server Message**:
```json
{
  "type": "scaleOffline",
  "scaleId": "SCALE-SMALL-01",
  "reason": "COM port read timeout (COM3)",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

**Client Behavior**:
```typescript
if (data.type === 'scaleOffline') {
  setOnline(false);

  showNotification({
    type: 'warning',
    message: `Scale ${scaleType.toUpperCase()} offline: ${data.reason}`,
    persistent: true
  });

  // Disable "Add Lot" button
  // Show offline indicator in UI
}
```

---

### 3. Latency Monitoring

**Performance Requirement**: <200ms from scale reading to UI update

**Measurement**:
```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const receiveTime = Date.now();
  const sendTime = new Date(data.timestamp).getTime();
  const latency = receiveTime - sendTime;

  if (latency > 200) {
    console.warn(`High latency detected: ${latency}ms (threshold: 200ms)`);
  }

  // Track latency metrics
  trackMetric('weight_scale_latency_ms', latency);
};
```

---

## Configuration

### Environment Variables (.env)

**Bridge Service**:
```bash
# WebSocket server configuration
BRIDGE_SERVICE_PORT=5000
ENABLE_WEBSOCKETS=true

# Scale hardware configuration
DEFAULT_SCALE_BAUD_RATE=9600
WEIGHT_POLLING_INTERVAL_MS=100
SCALE_CONTINUOUS_MODE=true

# Connection limits
MAX_WEBSOCKET_CONNECTIONS=50
WEBSOCKET_HEARTBEAT_INTERVAL_SEC=30
WEBSOCKET_IDLE_TIMEOUT_SEC=300
```

**Frontend**:
```bash
# WebSocket bridge URL
VITE_BRIDGE_SERVICE_URL=ws://localhost:5000
```

---

## Security Considerations

### 1. No Authentication Required

**Rationale**: WebSocket connection is on internal warehouse network only (192.168.0.x subnet)

**Network Isolation**:
- Bridge service binds to `0.0.0.0` (all interfaces) for warehouse network access
- Firewall rules restrict access to warehouse subnet only
- No public internet exposure

---

### 2. Message Validation

**Server-Side**:
```csharp
// Validate message type and structure
public void OnMessage(string message) {
    try {
        var data = JsonSerializer.Deserialize<WebSocketMessage>(message);

        if (!IsValidMessageType(data.Type)) {
            SendError("INVALID_MESSAGE_TYPE", "Unknown message type");
            return;
        }

        // Process message
    } catch (JsonException ex) {
        SendError("INVALID_JSON", "Malformed JSON message");
    }
}
```

---

## Performance Optimization

### 1. Debouncing Weight Updates

**Problem**: 100ms polling = 10 updates/second = potential UI jank

**Solution**: Use React 19 `useTransition` for concurrent rendering

```typescript
const [weight, setWeight] = useState(0);
const [isPending, startTransition] = useTransition();

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Mark weight update as low-priority (non-blocking)
  startTransition(() => {
    setWeight(data.weight);
  });
};

// UI remains responsive during weight updates
// isPending flag can show loading indicator
```

---

### 2. Connection Pooling

**Bridge Service**: Reuse COM port serial readers across multiple WebSocket connections

```csharp
// Singleton serial port reader per scale
private static Dictionary<string, SerialPortReader> _scaleReaders = new();

public SerialPortReader GetOrCreateReader(string scaleId) {
    if (!_scaleReaders.ContainsKey(scaleId)) {
        var config = GetScaleConfig(scaleId);
        _scaleReaders[scaleId] = new SerialPortReader(config.ComPort, config.BaudRate);
    }
    return _scaleReaders[scaleId];
}
```

---

## Testing

### Manual Testing Checklist

**Connection**:
- [ ] Frontend connects to bridge service on workstation selection
- [ ] Continuous mode starts automatically
- [ ] Weight updates stream at 100ms interval
- [ ] Latency < 200ms (measure with timestamp diff)

**Weight Validation**:
- [ ] Weight out of tolerance disables "Add Lot" button
- [ ] Weight within tolerance enables "Add Lot" button
- [ ] Stable flag (`stable: true`) when weight stabilizes
- [ ] Visual feedback (red/yellow/green) updates in real-time

**Error Handling**:
- [ ] Scale disconnect shows offline indicator
- [ ] Automatic reconnection after scale reconnect
- [ ] COM port error displays user-friendly message
- [ ] Bridge service crash triggers client reconnection

**Concurrent Operations**:
- [ ] Multiple workstations can connect to same scale
- [ ] Weight updates broadcast to all connected clients
- [ ] No race conditions in serial port reading

---

## TypeScript Types

```typescript
// WebSocket message types

export type WebSocketMessageType =
  | 'ping'
  | 'pong'
  | 'requestWeight'
  | 'startContinuous'
  | 'stopContinuous'
  | 'continuousStarted'
  | 'continuousStopped'
  | 'weightUpdate'
  | 'scaleOffline'
  | 'scaleOnline'
  | 'error';

export interface BaseMessage {
  type: WebSocketMessageType;
  timestamp: string; // ISO 8601
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
  serverTime: string; // ISO 8601
}

export interface StartContinuousMessage extends BaseMessage {
  type: 'startContinuous';
  pollingIntervalMs?: number;
}

export interface ContinuousStartedMessage extends BaseMessage {
  type: 'continuousStarted';
  pollingIntervalMs: number;
  scaleId: string;
  comPort: string;
}

export interface WeightUpdateMessage extends BaseMessage {
  type: 'weightUpdate';
  weight: number;
  unit: 'KG';
  stable: boolean;
  scaleId: string;
  scaleType: 'SMALL' | 'BIG';
}

export interface ScaleOfflineMessage extends BaseMessage {
  type: 'scaleOffline';
  scaleId: string;
  reason: string;
}

export interface ScaleOnlineMessage extends BaseMessage {
  type: 'scaleOnline';
  scaleId: string;
  comPort: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
  scaleId?: string;
  details?: Record<string, any>;
}

export type WebSocketMessage =
  | PingMessage
  | PongMessage
  | StartContinuousMessage
  | ContinuousStartedMessage
  | WeightUpdateMessage
  | ScaleOfflineMessage
  | ScaleOnlineMessage
  | ErrorMessage;
```

---

**Document Version**: 1.0
**Created**: 2025-10-06
**Constitutional Compliance**: Real-Time Weight Integration (Section IV) ✅
**Next**: Contract tests (failing stubs for TDD)
