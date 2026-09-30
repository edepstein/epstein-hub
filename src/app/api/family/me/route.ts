import { getFamilyContext } from "@/lib/auth/session";
import { familyError, familyJson } from "@/lib/family/errors";

export const dynamic = "force-dynamic";

/** GET: the caller's family access state (no private content). */
export async function GET() {
  const ctx = await getFamilyContext();
  switch (ctx.kind) {
    case "setup-needed":
      return familyError("setup_needed");
    case "unavailable":
      return familyError("service_unavailable");
    case "signed-out":
      return familyError("signed_out");
    case "no-access":
      return familyError(ctx.revoked ? "access_revoked" : "not_found");
    case "member":
      return familyJson({ familyId: ctx.family.id, role: ctx.membership.role, displayName: ctx.membership.displayName });
  }
}
