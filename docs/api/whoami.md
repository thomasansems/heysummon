# Verify API key

```
GET /api/v1/whoami
```

Verify your API key is valid and check its permissions.

---

## Request

```
x-api-key: hs_live_abc123...
```

---

## Response

```json
{
  "keyId": "cmxxx...",
  "name": "My Agent Key",
  "type": "client",
  "scopes": ["help:write", "help:read"],
  "userId": "cmyyy..."
}
```

---

## Example

```bash
curl http://localhost:3000/api/v1/whoami \
  -H "x-api-key: hs_live_abc123..."
```
