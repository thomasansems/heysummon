# Request Lifecycle & State Machine

HeySummon uses a formalized state machine to govern all request status transitions. Every transition is validated, logged to the audit trail, and protected against race conditions.

## State Diagram

```
  pending ──→ active ──→ responded ──→ closed
    │            │
    ├──→ expired ←──┘ (via active-monitor or TTL)
    └──→ closed
```

## Valid Transitions

| From | To | Trigger |
|------|----|---------|
| pending | active | Expert completes key exchange (`POST /key-exchange`) |
| pending | expired | TTL exceeded (active monitor) |
| pending | closed | Either party closes (`POST /close`) |
| active | responded | Expert sends first message (`POST /message`) or approves (`POST /approve`) |
| active | expired | TTL exceeded (active monitor) |
| active | closed | Either party closes |
| responded | closed | Either party closes |

## Auto-Computed Fields

- **respondedAt**: Set automatically when transitioning to `responded`
- **closedAt**: Set automatically when transitioning to `closed`
- **responseTimeMs**: Computed as `respondedAt - createdAt` in milliseconds

## Optimistic Concurrency

The state machine uses optimistic concurrency control. When two actors attempt the same transition simultaneously, only one succeeds. The second receives a `409 Conflict` response.

## Audit Trail

Every state transition is logged as a `STATE_TRANSITION` audit event with metadata:
- `requestId`: The request being transitioned
- `from`: Previous status
- `to`: New status
- `actor`: Who triggered the transition (userId or "system:active-monitor")

## Active Monitoring

A background job runs every 5 minutes (configurable via `HEYSUMMON_MONITOR_INTERVAL_MS`):

1. **Expiration**: Requests past their TTL are automatically expired
2. **Delivery Retry**: Failed deliveries are retried with exponential backoff
3. **Escalation**: Requests unacknowledged for 30+ minutes trigger escalation
