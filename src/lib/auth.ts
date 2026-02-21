import { auth } from "./auth-config";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  });

  return user;
}

export function generateApiKey(prefix: "htl_cli_" | "htl_prov_" = "htl_cli_"): string {
  const chars = "0123456789abcdef";
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}
