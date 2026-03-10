import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";

/**
 * DELETE /api/v1/provider/clients/:id — revoke a client key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  // Verify the client belongs to this provider
  const client = await prisma.apiKey.findFirst({
    where: { id, providerId: auth.apiKey.providerId },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
