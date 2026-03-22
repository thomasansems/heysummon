/**
 * Formalized request state machine for HeySummon.
 *
 * All request status transitions flow through this module, providing:
 * - Explicit valid transition definitions
 * - Optimistic concurrency (prevents race conditions via Prisma WHERE clause)
 * - Automatic audit logging for every state transition
 * - Auto-computed timestamps (respondedAt, closedAt)
 *
 * State diagram:
 *
 *   pending ──→ active ──→ responded ──→ closed
 *     │            │            │
 *     ├──→ expired ←────────────┘ (via active-monitor)
 *     └──→ closed  ←────────────┘
 */

import { prisma } from "./prisma";
import { logAuditEvent, AuditEventTypes } from "./audit";

export type RequestStatus =
  | "pending"
  | "active"
  | "responded"
  | "expired"
  | "closed";

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["active", "expired", "closed"],
  active: ["responded", "expired", "closed"],
  responded: ["closed"],
  expired: [],
  closed: [],
};

export class StaleStateError extends Error {
  constructor(
    public requestId: string,
    public expectedStatus: RequestStatus,
    public targetStatus: RequestStatus
  ) {
    super(
      `Cannot transition request ${requestId} from "${expectedStatus}" to "${targetStatus}" — current status has already changed`
    );
    this.name = "StaleStateError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public fromStatus: RequestStatus,
    public toStatus: RequestStatus
  ) {
    super(
      `Invalid state transition: "${fromStatus}" → "${toStatus}" is not allowed`
    );
    this.name = "InvalidTransitionError";
  }
}

interface TransitionMetadata {
  /** Who triggered the transition (userId, apiKeyId, or "system") */
  actor?: string;
  /** Additional context to include in the audit log */
  extra?: Record<string, unknown>;
  /** Request object for IP/User-Agent extraction in audit logs */
  request?: Request | { headers: Headers };
}

/**
 * Transition a help request from one status to another.
 *
 * Uses optimistic concurrency: the Prisma update includes `status: expectedStatus`
 * in the WHERE clause. If another actor already transitioned the request, the update
 * matches 0 rows and we throw StaleStateError.
 *
 * Auto-computes:
 * - `respondedAt` when transitioning to "responded"
 * - `closedAt` when transitioning to "closed"
 * - `responseTimeMs` when transitioning to "responded" (respondedAt - createdAt)
 */
export async function transitionRequest(
  requestId: string,
  expectedStatus: RequestStatus,
  newStatus: RequestStatus,
  metadata?: TransitionMetadata
) {
  // Validate the transition is allowed
  const allowed = VALID_TRANSITIONS[expectedStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new InvalidTransitionError(expectedStatus, newStatus);
  }

  const now = new Date();

  // Build the data payload with auto-computed fields
  const data: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "responded") {
    data.respondedAt = now;
  }

  if (newStatus === "closed") {
    data.closedAt = now;
  }

  // Use updateMany with compound WHERE for optimistic concurrency.
  // Prisma's update() throws on 0 matches; updateMany returns { count }.
  const result = await prisma.helpRequest.updateMany({
    where: {
      id: requestId,
      status: expectedStatus,
    },
    data,
  });

  if (result.count === 0) {
    throw new StaleStateError(requestId, expectedStatus, newStatus);
  }

  // Compute responseTimeMs if transitioning to responded
  if (newStatus === "responded") {
    const req = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { createdAt: true },
    });
    if (req) {
      const responseTimeMs = now.getTime() - req.createdAt.getTime();
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: { responseTimeMs },
      }).catch(() => {
        // Non-critical — don't fail the transition
      });
    }
  }

  // Fire-and-forget audit logging
  logAuditEvent({
    eventType: AuditEventTypes.STATE_TRANSITION,
    userId: metadata?.actor ?? null,
    success: true,
    metadata: {
      requestId,
      from: expectedStatus,
      to: newStatus,
      ...metadata?.extra,
    },
    request: metadata?.request,
  });

  return { requestId, previousStatus: expectedStatus, newStatus };
}

/**
 * Check if a transition is valid without performing it.
 */
export function isValidTransition(
  from: RequestStatus,
  to: RequestStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
