"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type FamilyRole } from "@/lib/family/authz";
import type { InviteItem, InviteState, MemberItem } from "@/lib/family/repo";
import { familyFetch } from "./client-api";

type Msg = { tone: "ok" | "error"; text: string } | null;

function Status({ msg }: { msg: Msg }) {
  return (
    <p className="status-line" data-tone={msg?.tone} role="status" aria-live="polite">
      {msg?.text}
    </p>
  );
}

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// ------------------------------------------------------------------------------ Family details
export function FamilySettingsForm({
  familyId,
  initial,
}: {
  familyId: string;
  initial: { title: string; recipientName: string | null; birthdayDate: string | null; timezone: string };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [recipientName, setRecipientName] = useState(initial.recipientName ?? "");
  const [birthdayDate, setBirthdayDate] = useState(initial.birthdayDate ?? "");
  const [timezone, setTimezone] = useState(initial.timezone);
  const [msg, setMsg] = useState<Msg>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  return (
    <form
      className="family-panel family-form"
      aria-labelledby="settings-title"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await familyFetch(`/api/family/${familyId}`, {
          method: "PATCH",
          json: { title, recipientName: recipientName.trim() || null, birthdayDate: birthdayDate || null, timezone },
        });
        setFields(r.ok ? {} : (r.fields ?? {}));
        setMsg(r.ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: r.message });
        if (r.ok) router.refresh();
      }}
    >
      <h2 id="settings-title">Family details</h2>
      <p className="form-hint">Only what you type here is shown. Leave the name and date empty until the family has agreed them; nothing is guessed.</p>
      <label htmlFor="s-title">Title of the family space</label>
      <input id="s-title" type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-invalid={fields.title ? true : undefined} />
      {fields.title ? <p className="form-error">{fields.title}</p> : null}
      <label htmlFor="s-recipient">Name of the person this is for (optional)</label>
      <input id="s-recipient" type="text" value={recipientName} maxLength={80} onChange={(e) => setRecipientName(e.target.value)} />
      <label htmlFor="s-date">Birthday date (optional)</label>
      <input id="s-date" type="date" value={birthdayDate} onChange={(e) => setBirthdayDate(e.target.value)} aria-invalid={fields.birthdayDate ? true : undefined} />
      {fields.birthdayDate ? <p className="form-error">{fields.birthdayDate}</p> : null}
      <label htmlFor="s-tz">Family time zone</label>
      <input id="s-tz" type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} aria-describedby="s-tz-hint" />
      <p id="s-tz-hint" className="form-hint">
        Used for dates in the Family Window, e.g. Europe/London.
      </p>
      <div className="toolbar">
        <button type="submit" className="btn">
          Save details
        </button>
      </div>
      <Status msg={msg} />
    </form>
  );
}

// ------------------------------------------------------------------------------ Invitations
export function InviteManager({ familyId, invites }: { familyId: string; invites: (InviteItem & { state: InviteState })[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<FamilyRole>("viewer");
  const [days, setDays] = useState(7);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="family-panel" aria-labelledby="invites-title">
      <h2 id="invites-title">Invitations</h2>
      <form
        className="family-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setLink(null);
          const r = await familyFetch<{ invite: { url: string; expiresAt: string } }>(`/api/family/${familyId}/invites`, {
            method: "POST",
            json: { email, displayName: name, role, expiresInDays: days },
          });
          setBusy(false);
          if (r.ok) {
            setLink(r.data.invite.url);
            setFields({});
            setMsg({ tone: "ok", text: `Invitation created. It expires ${fmt(r.data.invite.expiresAt)}. Copy the link now: it is shown only once.` });
            setEmail("");
            setName("");
            router.refresh();
          } else {
            setFields(r.fields ?? {});
            setMsg({ tone: "error", text: r.message });
          }
        }}
      >
        <label htmlFor="i-email">Their email address</label>
        <input id="i-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={fields.email ? true : undefined} />
        {fields.email ? <p className="form-error">{fields.email}</p> : null}
        <label htmlFor="i-name">Name the family knows them by</label>
        <input id="i-name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={fields.displayName ? true : undefined} />
        {fields.displayName ? <p className="form-error">{fields.displayName}</p> : null}
        <label htmlFor="i-role">Role</label>
        <select id="i-role" value={role} onChange={(e) => setRole(e.target.value as FamilyRole)} aria-describedby="i-role-hint">
          {(["viewer", "contributor", "curator"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <p id="i-role-hint" className="form-hint">
          {ROLE_DESCRIPTIONS[role]}
        </p>
        <label htmlFor="i-days">Link expires after (days, 1 to 30)</label>
        <input id="i-days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <div className="toolbar">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Creating…" : "Create invitation link"}
          </button>
        </div>
        <p className="form-hint">Send the link yourself (email or message). It works once, only for this email address, and only before it expires.</p>
      </form>
      {link ? (
        <div className="invite-link">
          <label htmlFor="i-link" className="sr-only">
            Invitation link
          </label>
          <input id="i-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMsg({ tone: "ok", text: "Link copied." });
              } catch {
                setMsg({ tone: "error", text: "Could not copy automatically. Select the link and copy it." });
              }
            }}
          >
            Copy link
          </button>
        </div>
      ) : null}
      <Status msg={msg} />
      {invites.length ? (
        <table className="family-table">
          <caption className="sr-only">Invitations sent</caption>
          <thead>
            <tr>
              <th scope="col">Invited</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.displayName}
                  <br />
                  <small>{i.email}</small>
                </td>
                <td>{ROLE_LABELS[i.role]}</td>
                <td>
                  <span className="status-pill" data-status={i.state}>
                    {i.state === "pending" ? `Waiting (expires ${fmt(i.expiresAt)})` : i.state === "accepted" ? "Accepted" : i.state === "revoked" ? "Cancelled" : "Expired"}
                  </span>
                </td>
                <td>
                  {i.state === "pending" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={async () => {
                        const r = await familyFetch(`/api/family/${familyId}/invites/${i.id}`, { method: "DELETE" });
                        setMsg(r.ok ? { tone: "ok", text: "Invitation cancelled." } : { tone: "error", text: r.message });
                        if (r.ok) router.refresh();
                      }}
                    >
                      Cancel invitation
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="form-hint">No invitations yet.</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------ Members
export function MemberManager({ familyId, members, selfId }: { familyId: string; members: MemberItem[]; selfId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  async function patch(userId: string, body: Record<string, string>, done: string) {
    const r = await familyFetch(`/api/family/${familyId}/members/${userId}`, { method: "PATCH", json: body });
    setMsg(r.ok ? { tone: "ok", text: done } : { tone: "error", text: r.message });
    if (r.ok) router.refresh();
  }
  return (
    <section className="family-panel" aria-labelledby="members-title">
      <h2 id="members-title">Members</h2>
      <p className="form-hint">Removing someone takes effect on their very next page or photo request. Photos they already downloaded cannot be recalled.</p>
      <table className="family-table">
        <caption className="sr-only">Family members</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Access</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId}>
              <td>
                {m.displayName}
                {m.userId === selfId ? " (you)" : ""}
              </td>
              <td>
                <label className="sr-only" htmlFor={`role-${m.userId}`}>
                  Role for {m.displayName}
                </label>
                <select
                  id={`role-${m.userId}`}
                  value={m.role}
                  disabled={m.status !== "active"}
                  onChange={(e) => void patch(m.userId, { role: e.target.value }, `${m.displayName} is now a ${ROLE_LABELS[e.target.value as FamilyRole].toLowerCase()}.`)}
                >
                  {(["viewer", "contributor", "curator"] as const).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="actions">
                <span className="status-pill" data-status={m.status}>
                  {m.status === "active" ? "Active" : "Removed"}
                </span>
                {m.status === "active" ? (
                  <button type="button" className="btn secondary" onClick={() => void patch(m.userId, { status: "revoked" }, `${m.displayName} no longer has access.`)}>
                    Remove access
                  </button>
                ) : (
                  <button type="button" className="btn secondary" onClick={() => void patch(m.userId, { status: "active" }, `${m.displayName}'s access is restored.`)}>
                    Restore access
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Status msg={msg} />
    </section>
  );
}
