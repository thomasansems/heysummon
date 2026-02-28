#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
/**
 * HeySummon OpenAPI spec generator for OWASP ZAP
 * Generates a spec describing all public API endpoints
 * so ZAP knows exactly what to test and with what payloads.
 */

const fs = require('fs');

const args = process.argv.slice(2);
const get = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const BASE_URL = get('--base-url') || 'http://localhost:3000';
const PROVIDER_KEY = get('--provider-key') || 'hs_prov_test';
const CLIENT_KEY = get('--client-key') || 'hs_cli_test';
const OUTPUT = get('--output') || '/tmp/heysummon-openapi.json';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'HeySummon API',
    version: '1.0.0',
    description: 'HeySummon public API — scanned by OWASP ZAP',
  },
  servers: [{ url: BASE_URL }],
  components: {
    securitySchemes: {
      providerKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
      clientKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },

    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
      HelpRequest: {
        type: 'object',
        required: ['apiKey', 'question'],
        properties: {
          apiKey: { type: 'string', example: CLIENT_KEY },
          question: { type: 'string', example: 'How do I reset my password?' },
          signPublicKey: { type: 'string', example: 'aabbcc...' },
          encryptPublicKey: { type: 'string', example: 'ddeeff...' },
          messages: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
      MessageRequest: {
        type: 'object',
        required: ['from', 'plaintext'],
        properties: {
          from: { type: 'string', enum: ['provider', 'consumer'] },
          plaintext: { type: 'string', example: 'Here is my response.' },
        },
      },
    },
  },

  paths: {
    // ── Health ─────────────────────────────────────────────────────────
    '/api/v1/health': {
      get: {
        tags: ['system'],
        summary: 'Health check',
        responses: {
          200: { description: 'Platform is healthy' },
        },
      },
    },

    // ── V1 Public API ──────────────────────────────────────────────────
    '/api/v1/whoami': {
      get: {
        tags: ['auth'],
        summary: 'Get current key identity',
        security: [{ providerKey: [] }],
        parameters: [
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Key info' },
          401: { description: 'Invalid key' },
          403: { description: 'Deactivated or device-locked key' },
        },
      },
    },

    '/api/v1/help': {
      post: {
        tags: ['consumer'],
        summary: 'Submit a help request (consumer)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HelpRequest' },
              examples: {
                valid: {
                  summary: 'Valid request',
                  value: {
                    apiKey: CLIENT_KEY,
                    question: 'How do I reset my password?',
                  },
                },
                xss: {
                  summary: 'XSS attempt',
                  value: {
                    apiKey: CLIENT_KEY,
                    question: '<script>alert(1)</script>',
                  },
                },
                sqlInjection: {
                  summary: 'SQL injection attempt',
                  value: {
                    apiKey: CLIENT_KEY,
                    question: "'; DROP TABLE requests; --",
                  },
                },
                pii: {
                  summary: 'PII in question',
                  value: {
                    apiKey: CLIENT_KEY,
                    question: 'My SSN is 123-45-6789 and card 4111111111111111',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Request created' },
          401: { description: 'Invalid API key' },
          422: { description: 'Content blocked by Guard' },
        },
      },
    },

    '/api/v1/help/{requestId}': {
      get: {
        tags: ['consumer'],
        summary: 'Get help request status',
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'nonexistent-id',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: CLIENT_KEY,
          },
        ],
        responses: {
          200: { description: 'Request details' },
          403: { description: 'Access denied' },
          404: { description: 'Not found' },
        },
      },
    },

    '/api/v1/message/{requestId}': {
      post: {
        tags: ['provider'],
        summary: 'Send a message on a request (provider)',
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'nonexistent-request-id',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MessageRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Message sent' },
          403: { description: 'Not your request' },
          404: { description: 'Request not found' },
        },
      },
    },

    '/api/v1/messages/{requestId}': {
      get: {
        tags: ['provider'],
        summary: 'List messages for a request',
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'nonexistent-request-id',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Message list' },
          403: { description: 'Access denied' },
          404: { description: 'Not found' },
        },
      },
    },

    '/api/v1/close/{requestId}': {
      post: {
        tags: ['provider'],
        summary: 'Close a request',
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'nonexistent-request-id',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Request closed' },
          403: { description: 'Access denied' },
          404: { description: 'Not found' },
        },
      },
    },

    '/api/v1/requests/by-ref/{refCode}': {
      get: {
        tags: ['provider'],
        summary: 'Get request by ref code',
        parameters: [
          {
            name: 'refCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'HS-INVALID',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Request details' },
          403: { description: 'Access denied' },
          404: { description: 'Not found' },
        },
      },
    },

    '/api/v1/events/pending': {
      get: {
        tags: ['events'],
        summary: 'Get pending (undelivered) events',
        parameters: [
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Pending events' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    '/api/v1/events/ack/{requestId}': {
      post: {
        tags: ['events'],
        summary: 'Acknowledge an event delivery',
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'nonexistent-request-id',
          },
          {
            name: 'x-api-key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            example: PROVIDER_KEY,
          },
        ],
        responses: {
          200: { description: 'Acknowledged' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ── Auth endpoints (dashboard) ─────────────────────────────────────
    '/api/auth/login': {
      post: {
        tags: ['dashboard-auth'],
        summary: 'Dashboard login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'admin@example.com' },
                  password: { type: 'string', example: 'wrongpassword' },
                },
              },
              examples: {
                bruteForce: {
                  summary: 'Brute force attempt',
                  value: { email: 'admin@example.com', password: 'password123' },
                },
                sqlInjection: {
                  summary: 'SQL injection in email',
                  value: { email: "admin'--", password: 'x' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limited' },
        },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['dashboard-auth'],
        summary: 'Dashboard registration',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'attacker@evil.com' },
                  password: { type: 'string', example: 'password123' },
                  name: { type: 'string', example: 'Attacker' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Registered' },
          403: { description: 'Registration disabled' },
          409: { description: 'Already exists' },
        },
      },
    },
  },
};

fs.writeFileSync(OUTPUT, JSON.stringify(spec, null, 2));
console.log(`✅ OpenAPI spec written to ${OUTPUT}`);
console.log(`   Paths: ${Object.keys(spec.paths).length}`);
