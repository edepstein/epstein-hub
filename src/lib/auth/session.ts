import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createRequestSupabase } from "@/lib/supabase/server";
import type { FamilyRole, MembershipStatus } from "@/lib/family/authz";

export interface FamilyRow {
  id: string;
  title: string;
  recipientName: string | null;
  birthdayDate: string | null;
  timezone: string;
  isFictionalFixture: boolean;
}

export interface MembershipRow {
  familyId: string;
  userId: string;
  role: FamilyRole;
  status: MembershipStatus;
  displayName: string;
}

export type FamilyContext =
  | { kind: "setup-needed" }
  | { kind: "unavailable" }
  | { kind: "signed-out" }
  | { kind: "no-access"; email: string | null; revoked: boolean }
  | { kind: "member"; supabase: SupabaseClient; user: { id: string; email: string | null }; membership: MembershipRow; family: FamilyRow };

export type UserResult =
  | { kind: "setup-needed" }
  | { kind: "unavailable" }
  | { kind: "signed-out" }
  | { kind: "user"; supabase: SupabaseClient; user: User };

/** Resolve the signed-in user with a verified call to Supabase Auth (never trusts a cookie alone). */
export async function getSignedInUser(): Promise<UserResult> {
  const supabase = await createRequestSupabase();
  if (!supabase) return { kind: "setup-needed" };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const status = (error as { status?: number }).status ?? 0;
      if (error.name === "AuthRetryableFetchError" || status >= 500) return { kind: "unavailable" };
      return { kind: "signed-out" };
    }
    if (!data.user) return { kind: "signed-out" };
    return { kind: "user", supabase, user: data.user };
  } catch {
    return { kind: "unavailable" };
  }
}

export function toMembership(r: Record<string, unknown>): MembershipRow {
  return {
    familyId: String(r.family_id),
    userId: String(r.user_id),
    role: r.role as FamilyRole,
    status: r.status as MembershipStatus,
    displayName: String(r.display_name ?? ""),
  };
}

export function toFamily(r: Record<string, unknown>): FamilyRow {
  return {
    id: String(r.id),
    title: String(r.title),
    recipientName: (r.recipient_name as string | null) ?? null,
    birthdayDate: (r.birthday_date as string | null) ?? null,
    timezone: String(r.timezone ?? "Europe/London"),
    isFictionalFixture: Boolean(r.is_fictional_fixture),
  };
}

/**
 * The page-level family context: which family (the member's earliest active membership) and
 * role. Revoked or absent memberships produce a no-access state with a plain explanation.
 */
export async function getFamilyContext(): Promise<FamilyContext> {
  const u = await getSignedInUser();
  if (u.kind !== "user") return u;
  const { supabase, user } = u;
  const { data: rows, error } = await supabase
    .from("family_memberships")
    .select("family_id, user_id, role, status, display_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return { kind: "unavailable" };
  const memberships = (rows ?? []).map(toMembership);
  const active = memberships.find((m) => m.status === "active");
  if (!active) return { kind: "no-access", email: user.email ?? null, revoked: memberships.length > 0 };
  const { data: fam, error: famErr } = await supabase
    .from("families")
    .select("id, title, recipient_name, birthday_date, timezone, is_fictional_fixture")
    .eq("id", active.familyId)
    .maybeSingle();
  if (famErr) return { kind: "unavailable" };
  if (!fam) return { kind: "no-access", email: user.email ?? null, revoked: true };
  return { kind: "member", supabase, user: { id: user.id, email: user.email ?? null }, membership: active, family: toFamily(fam) };
}
