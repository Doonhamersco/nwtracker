import { isEmailAllowed, normalizeEmail, ownerEmail } from "@/lib/users/identity";

/**
 * Bearer imports have no session. They land on the owner unless the body names
 * another invited address.
 */
export function resolveImportTarget(requested: string | undefined): string {
  const email = requested ? normalizeEmail(requested) : ownerEmail();
  if (!email || !isEmailAllowed(email)) {
    throw new Error("User is not on the invite list");
  }
  return email;
}
