# Rate Response

Rate a provider's response quality. Enables feedback signals for provider reliability tracking.

## Endpoint

```
POST /api/v1/rate/:requestId
```

## Authentication

Consumer API key via `x-api-key` header. The consumer must own the request being rated.

## Request Body

```json
{
  "rating": 4,
  "feedback": "Optional text feedback"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rating | integer | Yes | Quality score, 1 (poor) to 5 (excellent) |
| feedback | string | No | Optional text feedback (max 2000 chars) |

## Constraints

- Request must have status `responded` or `closed`
- Cannot rate a `pending`, `active`, or `expired` request (returns 400)
- Once rated, cannot re-rate (returns 409 with existing rating)
- Only the consumer who created the request can rate it (returns 403)

## Response

```json
{
  "success": true,
  "rating": 4,
  "ratedAt": "2026-03-20T10:30:00.000Z"
}
```

## Provider Metrics

Each rating triggers an async recalculation of `ProviderMetrics`:

- **avgRating**: Average across all rated requests
- **avgResponseTimeMs**: Average time from request creation to first response
- **reliability**: `responded / (responded + expired)` ratio
- **totalResponded**: Count of requests that received a response
- **totalExpired**: Count of requests that expired without response
