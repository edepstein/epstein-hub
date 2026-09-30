/**
 * Role capabilities, mirroring the RLS policies in supabase/migrations. The UI uses these to
 * decide which actions to offer and the API uses them for early, clear 403s. They are NOT the
 * security boundary: Postgres RLS re-checks every query as the signed-in user.
 */
export type FamilyRole = "viewer" | "contributor" | "curator";
export type MembershipStatus = "active" | "revoked";
export const FAMILY_ROLES: readonly FamilyRole[] = ["viewer", "contributor", "curator"];

export type FamilyAction =
  | "read"
  | "reply"
  | "favourite"
  | "contribute"
  | "moderate"
  | "invite"
  | "manage_members"
  | "compose_book"
  | "edit_family";

const MIN_ROLE: Record<FamilyAction, FamilyRole> = {
  read: "viewer",
  reply: "viewer",
  favourite: "viewer",
  contribute: "contributor",
  moderate: "curator",
  invite: "curator",
  manage_members: "curator",
  compose_book: "curator",
  edit_family: "curator",
};

export function roleRank(role: FamilyRole): number {
  return FAMILY_ROLES.indexOf(role);
}

export function isFamilyRole(value: unknown): value is FamilyRole {
  return typeof value === "string" && (FAMILY_ROLES as readonly string[]).includes(value);
}

export function can(membership: { role: FamilyRole; status: MembershipStatus } | null | undefined, action: FamilyAction): boolean {
  if (!membership || membership.status !== "active") return false;
  return roleRank(membership.role) >= roleRank(MIN_ROLE[action]);
}

export function minimumRole(action: FamilyAction): FamilyRole {
  return MIN_ROLE[action];
}

export type PostStatus = "draft" | "submitted" | "published" | "withdrawn" | "deleted";

/** Post actions an actor may take, given role, authorship and status (mirrors RLS + RPC). */
export function allowedPostActions(
  membership: { role: FamilyRole; status: MembershipStatus } | null,
  post: { status: PostStatus; isAuthor: boolean },
): ("edit" | "submit" | "unsubmit" | "delete" | "approve" | "withdraw")[] {
  if (!membership || membership.status !== "active") return [];
  const out: ("edit" | "submit" | "unsubmit" | "delete" | "approve" | "withdraw")[] = [];
  const curator = membership.role === "curator";
  const ownDraft = post.isAuthor && can(membership, "contribute") && (post.status === "draft" || post.status === "submitted");
  if (ownDraft || (curator && post.status !== "deleted")) out.push("edit");
  if (ownDraft && post.status === "draft") out.push("submit");
  if (ownDraft && post.status === "submitted") out.push("unsubmit");
  if (ownDraft || (curator && post.status !== "deleted")) out.push("delete");
  if (curator && (post.status === "submitted" || post.status === "withdrawn")) out.push("approve");
  if (curator && (post.status === "published" || post.status === "submitted")) out.push("withdraw");
  return out;
}

/** Roles a curator may assign. Only curators manage roles; nobody can raise their own role. */
export function canChangeMember(actor: { userId: string; role: FamilyRole; status: MembershipStatus }, targetUserId: string): boolean {
  return actor.status === "active" && actor.role === "curator" && typeof targetUserId === "string" && targetUserId.length > 0;
}

export const ROLE_LABELS: Record<FamilyRole, string> = {
  viewer: "Reader",
  contributor: "Contributor",
  curator: "Curator",
};

export const ROLE_DESCRIPTIONS: Record<FamilyRole, string> = {
  viewer: "Reads published updates and the Birthday Book, favourites and replies.",
  contributor: "Also adds photographs and captions for the curator to review.",
  curator: "Also reviews contributions, arranges the book and manages invitations and members.",
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft (only you can see it)",
  submitted: "Waiting for the curator's review",
  published: "Published to the family",
  withdrawn: "Withdrawn by the curator",
  deleted: "Deleted",
};
