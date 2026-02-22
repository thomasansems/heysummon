/**
 * Guard content-validation client stub.
 * TODO: implement full guard sidecar integration.
 */

export interface GuardResult {
  safe: boolean;
  flags: string[];
}

export async function validateContent(
  _content: string,
): Promise<GuardResult> {
  return { safe: true, flags: [] };
}
