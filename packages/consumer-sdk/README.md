# @heysummon/consumer-sdk

TypeScript SDK for [HeySummon](https://heysummon.ai) consumers (AI agents). Submit help requests to human experts, poll for responses, and optionally encrypt messages end-to-end.

## Install

```bash
pnpm install @heysummon/consumer-sdk
```

## Quick Start

```typescript
import { HeySummonClient } from "@heysummon/consumer-sdk";

const client = new HeySummonClient({
  baseUrl: "https://cloud.heysummon.ai",
  apiKey: process.env.HEYSUMMON_API_KEY!,
});

// Submit a help request
const result = await client.submitRequest({
  question: "Should I proceed with the database migration?",
});

// Poll for the response
const status = await client.getRequestStatus(result.requestId!);
console.log(status.response);
```

## Client API

### `HeySummonClient`

All methods authenticate via the `x-api-key` header using the API key provided at construction.

```typescript
const client = new HeySummonClient({ baseUrl, apiKey });
```

| Method | Description |
|--------|-------------|
| `whoami()` | Identify which provider this API key is linked to |
| `submitRequest(opts)` | Submit a help request to a human expert |
| `getRequestStatus(requestId)` | Get the current status of a request |
| `getRequestByRef(refCode)` | Look up a request by its `HS-XXXX` reference code |
| `getPendingEvents()` | Poll for pending events (new messages, responses, etc.) |
| `ackEvent(requestId)` | Acknowledge a specific event |
| `getMessages(requestId)` | Fetch the full message history for a request |
| `reportTimeout(requestId)` | Report that the client's poll timed out |

### Submit Request Options

```typescript
interface SubmitRequestOptions {
  question: string;
  messages?: Array<{ role: string; content: string }>;
  signPublicKey?: string;
  encryptPublicKey?: string;
  providerName?: string;
  requiresApproval?: boolean;
}
```

### Approval Requests

Set `requiresApproval: true` to show Approve/Deny buttons to the provider instead of a free-text reply prompt. The decision is delivered as a message event:

```typescript
const result = await client.submitRequest({
  question: "Should I proceed with the $5,000 purchase?",
  requiresApproval: true,
});

// Poll until the provider decides
const status = await client.getRequestStatus(result.requestId!);
if (status.status === "responded") {
  const messages = await client.getMessages(result.requestId!);
  // Provider message contains "approved" or "denied"
}
```

### Error Handling

The client throws `HeySummonHttpError` for non-2xx responses:

```typescript
import { HeySummonHttpError } from "@heysummon/consumer-sdk";

try {
  await client.submitRequest({ question: "..." });
} catch (err) {
  if (err instanceof HeySummonHttpError) {
    console.error(err.status, err.body);
    if (err.isAuthError) {
      // 401, 403, or 404
    }
  }
}
```

## End-to-End Encryption

The SDK includes X25519 + AES-256-GCM encryption with Ed25519 signatures.

### Ephemeral Keys (in-memory)

```typescript
import { generateEphemeralKeys } from "@heysummon/consumer-sdk";

const keys = generateEphemeralKeys();
// { signPublicKey: "hex...", encryptPublicKey: "hex..." }

await client.submitRequest({
  question: "Sensitive question",
  signPublicKey: keys.signPublicKey,
  encryptPublicKey: keys.encryptPublicKey,
});
```

### Persistent Keys (file-based)

```typescript
import { generatePersistentKeys, loadPublicKeys } from "@heysummon/consumer-sdk";

// Generate and save to disk
const keys = generatePersistentKeys("/path/to/keys");

// Load existing keys without regenerating
const existing = loadPublicKeys("/path/to/keys");
```

### Encrypt / Decrypt

```typescript
import { encrypt, decrypt } from "@heysummon/consumer-sdk";

const encrypted = encrypt(
  "Hello, human!",
  "/path/to/recipient_encrypt_public.pem",
  "/path/to/own_sign_private.pem",
  "/path/to/own_encrypt_private.pem"
);

const plaintext = decrypt(
  encrypted,
  "/path/to/sender_encrypt_public.pem",
  "/path/to/sender_sign_public.pem",
  "/path/to/own_encrypt_private.pem"
);
```

## Provider Store

Manage multiple provider registrations in a local JSON file:

```typescript
import { ProviderStore } from "@heysummon/consumer-sdk";

const store = new ProviderStore("/path/to/providers.json");

store.add({
  name: "My Expert",
  apiKey: "hs_cli_...",
  providerId: "...",
  providerName: "Expert Name",
});

const provider = store.findByName("My Expert");
const defaultProvider = store.getDefault();
```

## CLI

The package includes a CLI for use in shell scripts and automation:

```bash
pnpm dlx @heysummon/consumer-sdk <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `submit-and-poll` | Submit a request and wait for a response |
| `add-provider` | Register a provider by API key |
| `list-providers` | List registered providers |
| `check-status` | Check the status of an existing request |
| `keygen` | Generate persistent encryption key pairs |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEYSUMMON_BASE_URL` | Yes | Platform URL (e.g. `https://cloud.heysummon.ai`) |
| `HEYSUMMON_API_KEY` | Varies | Consumer API key (not needed if using provider store) |
| `HEYSUMMON_PROVIDERS_FILE` | No | Path to providers.json for multi-provider setups |
| `HEYSUMMON_TIMEOUT` | No | Poll timeout in seconds (default: 900) |
| `HEYSUMMON_POLL_INTERVAL` | No | Poll interval in seconds (default: 3) |

### Examples

```bash
# Submit and wait for a response
HEYSUMMON_BASE_URL=https://cloud.heysummon.ai \
HEYSUMMON_API_KEY=hs_cli_... \
pnpm dlx @heysummon/consumer-sdk submit-and-poll --question "Should I deploy?"

# Register a provider
HEYSUMMON_BASE_URL=https://cloud.heysummon.ai \
HEYSUMMON_PROVIDERS_FILE=./providers.json \
pnpm dlx @heysummon/consumer-sdk add-provider --key hs_cli_... --alias "DevOps Lead"

# Check request status
HEYSUMMON_BASE_URL=https://cloud.heysummon.ai \
HEYSUMMON_API_KEY=hs_cli_... \
pnpm dlx @heysummon/consumer-sdk check-status --ref HS-1234

# Generate encryption keys
pnpm dlx @heysummon/consumer-sdk keygen --dir ./keys
```

## License

MIT
