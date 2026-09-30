import Link from "next/link";

/**
 * Non-member states of the family space. None of them reveal anything about any family:
 * no names, titles, counts or photographs.
 */

export function SetupNeeded() {
  return (
    <section className="family-panel family-state" data-state="setup-needed" aria-labelledby="setup-title">
      <h2 id="setup-title">Setup needed</h2>
      <p>
        The private family space is not connected yet. It needs the site owner to connect a private database, secure sign-in and
        private photo storage before anyone can sign in.
      </p>
      <p className="form-hint">Nothing is shown here until that is done: there is no sample family and no demonstration login.</p>
      <div className="toolbar">
        <Link className="btn secondary" href="/">
          Back to the puzzles
        </Link>
      </div>
    </section>
  );
}

export function SignedOut({ next = "/family" }: { next?: string }) {
  return (
    <section className="family-panel family-state" data-state="signed-out" aria-labelledby="signed-out-title">
      <h2 id="signed-out-title">Invitation required</h2>
      <p>This is a private space for one family. You need an invitation from the family curator, then you can sign in with the invited email address.</p>
      <div className="toolbar">
        <Link className="btn" href={`/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
        <Link className="btn secondary" href="/">
          Play the puzzles instead
        </Link>
      </div>
    </section>
  );
}

export function NoAccess({ revoked, email }: { revoked: boolean; email: string | null }) {
  return (
    <section className="family-panel family-state" data-state={revoked ? "access-revoked" : "no-membership"} aria-labelledby="no-access-title">
      <h2 id="no-access-title">{revoked ? "Your access has been removed" : "No family access for this account"}</h2>
      {revoked ? (
        <p>This account can no longer open the family space. If you think this is a mistake, ask the family curator to restore your access.</p>
      ) : (
        <p>
          You are signed in{email ? ` as ${email}` : ""}, but this account has not joined a family. Open the invitation link you were sent, or ask the family
          curator for an invitation to this address.
        </p>
      )}
    </section>
  );
}

export function Unavailable() {
  return (
    <section className="family-panel family-state" data-state="unavailable" aria-labelledby="unavailable-title">
      <h2 id="unavailable-title">The family space cannot be reached just now</h2>
      <p>This is usually brief. Nothing has been lost. Please try again in a moment.</p>
    </section>
  );
}

export function PermissionDenied({ what }: { what: string }) {
  return (
    <section className="family-panel family-state" data-state="permission-denied" aria-labelledby="denied-title">
      <h2 id="denied-title">Not available for your role</h2>
      <p>{what}</p>
      <div className="toolbar">
        <Link className="btn secondary" href="/family">
          Family space home
        </Link>
      </div>
    </section>
  );
}
