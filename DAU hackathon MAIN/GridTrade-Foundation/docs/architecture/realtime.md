# GridTrade — Real-Time Architecture

## Transport: Server-Sent Events (SSE)

GridTrade uses **SSE** (not WebSocket or Socket.IO) for real-time data delivery.

**Endpoint**: `GET /api/v1/operations/realtime/stream`

**Headers required**:
```
Authorization: Bearer <token>
Accept: text/event-stream
Cache-Control: no-cache
```

---

## Event Envelope Format

All events follow a canonical envelope:

```json
{
  "eventId": "evt-client-123-abc456",
  "eventType": "connection:established",
  "version": "1",
  "occurredAt": "2026-09-12T10:00:00.000Z",
  "data": { ... }
}
```

| Field | Description |
|---|---|
| `eventId` | Unique event identifier for idempotent client processing |
| `eventType` | Namespaced event type (e.g. `trade.executed`, `grid.updated`) |
| `version` | Schema version for forward-compatibility |
| `occurredAt` | Server-authoritative ISO-8601 timestamp |
| `data` | Event payload |

---

## Room Authorization Matrix

Clients subscribe to typed rooms. The server enforces the following authorization:

| Room | Allowed Roles | Description |
|---|---|---|
| `market:GLOBAL` | ALL | Marketplace events (listings, demands, prices) |
| `user:<userId>` | Owner, ADMIN | Personal trade confirmations, payment events |
| `grid:<region>` | ALL | Grid status updates for a region |
| `utility:<region>` | UTILITY, ADMIN | Feeder load, DISCOM operations |
| `regulator` | REGULATOR, ADMIN | Compliance events, audit triggers |
| `admin` | ADMIN only | Platform health, system alerts |
| `simulation` | UTILITY, ADMIN | Grid simulation scenario results |

Unauthorized room subscription attempts are silently ignored by `RealtimeHub.canSubscribe()`.

---

## Connection Lifecycle

```
Client                             Server (RealtimeHub)
  │                                        │
  │  GET /realtime/stream                  │
  │  Authorization: Bearer <token>         │
  ├───────────────────────────────────────▶│
  │                                        │ 1. Resolve token → AuthContext
  │                                        │ 2. Register client ID
  │                                        │ 3. Subscribe to requested rooms
  │◀───────────────────────────────────────┤
  │  HTTP/1.1 200 text/event-stream        │
  │  data: {connection:established}        │
  │                                        │
  │  ← heartbeat (": heartbeat") every 25s │
  │  ← event data as SSE stream            │
  │                                        │
  │  [client closes / network drop]        │
  ├───────────────────────────────────────▶│
  │                                        │ removeClient(clientId)
```

---

## Event Publisher

Events are published from services using `eventPublisher.publish(event)`:

```typescript
// From trade.service.ts after a successful execution:
await eventPublisher.publish({
  type: "trade.executed",
  tradeId: trade.id,
  buyerId: trade.buyerId,
  sellerId: trade.listing.sellerId,
  quantityKwh: result.finalKwh,
  occurredAt: new Date().toISOString(),
});
```

The `RealtimeHub` routes the event to all subscribed clients based on room membership.

---

## Reconnection

SSE clients automatically reconnect. The `EventSource` API in browsers retries with exponential backoff. On reconnect:

1. Client re-sends `Authorization: Bearer <token>` header (via query param fallback if needed)
2. Server registers a new client ID
3. Server re-sends connection established event
4. Client re-subscribes to rooms from the query param `?rooms=...`

> **Note**: SSE is stateless per connection — no message replay is implemented. Missing events during a disconnection gap are not delivered. This is by design for operational simplicity; clients poll for state on reconnect.

---

## Key Files

| File | Purpose |
|---|---|
| [`socket-server.ts`](file:///c:/Users/T14s/OneDrive/Desktop/outlier/GridTrade-Foundation_BY_REPLIT/GridTrade-Foundation/artifacts/api-server/src/realtime/socket-server.ts) | `RealtimeHub` class — client registry, room auth, event fan-out |
| [`events.ts`](file:///c:/Users/T14s/OneDrive/Desktop/outlier/GridTrade-Foundation_BY_REPLIT/GridTrade-Foundation/artifacts/api-server/src/realtime/events.ts) | `eventPublisher` — typed event emission helpers |
| [`operations.controller.ts`](file:///c:/Users/T14s/OneDrive/Desktop/outlier/GridTrade-Foundation_BY_REPLIT/GridTrade-Foundation/artifacts/api-server/src/controllers/operations.controller.ts) | SSE HTTP handler — auth guard, heartbeat, registration |

---

## Constraints

- SSE is unidirectional (server → client only)
- No WebSocket — avoids connection upgrade complexity and load-balancer sticky session requirements
- Max concurrent clients: limited by Node.js connection count (scales horizontally behind a load balancer with sticky headers)
- Heartbeat interval: 25 seconds (keeps connection alive through proxies with 30s idle timeout)
