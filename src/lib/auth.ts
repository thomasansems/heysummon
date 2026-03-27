import { auth } from "./auth-config";
import { prisma } from "./prisma";
import crypto from "crypto";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, onboardingComplete: true },
  });

  return user;
}

export function generateApiKey(prefix: "hs_cli_" | "hs_prov_" = "hs_cli_"): string {
  return prefix + crypto.randomBytes(16).toString("hex");
}
