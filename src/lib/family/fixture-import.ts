/**
 * Development-only importer for reference/build-pack-v3/content/birthday-demo.json.
 *
 * Guards: refuses any production-like environment, refuses non-local databases unless an
 * explicit sandbox flag is set, refuses fixtures that are not marked fictional, and labels every
 * imported string as fictional. Posts are imported as drafts and the book is never published,
 * so nothing fictional can reach a reader view by accident.
 */

export interface BirthdayFixture {
  fixtureVersion: number;
  environment: string;
  fictional: boolean;
  productionImportAllowed: boolean;
  family: { displayName: string; timezone?: string };
  posts?: { caption: string }[];
  book?: { title: string; dedication?: string | null; chapters: { title: string; items: { type: string; heading?: string; body?: string }[] }[] };
}

type Env = Record<string, string | undefined>;

export class FixtureImportRefused extends Error {}

export function assertFixtureImportAllowed(env: Env, databaseUrl: string | undefined): void {
  const prodFlags = [env.NODE_ENV === "production", env.VERCEL_ENV === "production", env.FAMILY_ENV === "production", env.APP_ENV === "production"];
  if (prodFlags.some(Boolean)) throw new FixtureImportRefused("Refusing to import fictional fixtures into a production environment.");
  if (!databaseUrl) throw new FixtureImportRefused("Set DATABASE_URL to a local development database.");
  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new FixtureImportRefused("DATABASE_URL is not a valid URL.");
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
  if (!local && env.FAMILY_FIXTURE_SANDBOX !== "i-understand-this-is-a-nonproduction-sandbox") {
    throw new FixtureImportRefused("Refusing to import into a non-local database. Fixtures are for local development only.");
  }
}

export function validateFixture(f: unknown): asserts f is BirthdayFixture {
  const x = f as Partial<BirthdayFixture> | null;
  if (!x || typeof x !== "object") throw new FixtureImportRefused("Fixture is not an object.");
  if (x.fictional !== true) throw new FixtureImportRefused("Fixture is not marked fictional: refusing to import.");
  if (x.productionImportAllowed !== false) throw new FixtureImportRefused("Fixture must declare productionImportAllowed: false.");
  if (x.environment !== "development-only") throw new FixtureImportRefused("Fixture must declare environment: development-only.");
  if (!x.family || typeof x.family.displayName !== "string") throw new FixtureImportRefused("Fixture has no family.");
}

/** Make sure a string is visibly labelled as fictional. */
export function labelFictional(s: string): string {
  return /fictional|placeholder|demonstration|demo/i.test(s) ? s : `[Fictional] ${s}`;
}

const lit = (s: string | null | undefined) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SQL for a local database (run with a privileged local connection, e.g. `supabase db` or psql).
 * The given auth user ids must already exist locally (create them by signing in on the local
 * Supabase stack first).
 */
export function buildFixtureSql(f: BirthdayFixture, users: { curatorUserId: string; viewerUserId?: string }): string {
  if (!uuidRe.test(users.curatorUserId) || (users.viewerUserId && !uuidRe.test(users.viewerUserId))) {
    throw new FixtureImportRefused("User ids must be UUIDs of existing local auth users.");
  }
  const lines: string[] = [
    "-- FICTIONAL DEVELOPMENT FIXTURE. NEVER RUN AGAINST PRODUCTION.",
    "begin;",
    "do $$",
    "declare v_family uuid; v_book uuid; v_chapter uuid; v_post uuid;",
    "begin",
    `  insert into public.families (title, timezone, is_fictional_fixture) values (${lit(labelFictional(f.family.displayName))}, ${lit(f.family.timezone ?? "Europe/London")}, true) returning id into v_family;`,
    `  insert into public.family_memberships (family_id, user_id, role, display_name) values (v_family, '${users.curatorUserId}', 'curator', 'Demo curator (fictional)');`,
  ];
  if (users.viewerUserId) {
    lines.push(`  insert into public.family_memberships (family_id, user_id, role, display_name) values (v_family, '${users.viewerUserId}', 'viewer', 'Demo reader (fictional)');`);
  }
  for (const p of f.posts ?? []) {
    lines.push(`  insert into public.family_posts (family_id, author_id, caption, status) values (v_family, '${users.curatorUserId}', ${lit(labelFictional(p.caption).slice(0, 500))}, 'draft') returning id into v_post;`);
  }
  if (f.book) {
    lines.push(`  insert into public.family_books (family_id, title, dedication) values (v_family, ${lit(labelFictional(f.book.title))}, ${lit(f.book.dedication ? labelFictional(f.book.dedication) : null)}) returning id into v_book;`);
    f.book.chapters.forEach((c, ci) => {
      lines.push(`  insert into public.book_chapters (family_id, book_id, title, position) values (v_family, v_book, ${lit(labelFictional(c.title))}, ${ci}) returning id into v_chapter;`);
      c.items
        .filter((it) => it.type === "letter" || it.type === "story")
        .forEach((it, ii) => {
          lines.push(
            `  insert into public.book_entries (family_id, chapter_id, kind, heading, body, position) values (v_family, v_chapter, '${it.type}', ${lit(it.heading ? labelFictional(it.heading) : null)}, ${lit(labelFictional(it.body ?? "Placeholder"))}, ${ii});`,
          );
        });
    });
  }
  lines.push("end $$;", "commit;");
  return lines.join("\n") + "\n";
}
