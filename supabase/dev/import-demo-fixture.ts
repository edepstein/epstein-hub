/**
 * Print SQL that loads the FICTIONAL birthday demo fixture into a LOCAL development database.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     pnpm exec tsx supabase/dev/import-demo-fixture.ts --curator <local-auth-user-uuid> [--viewer <uuid>] \
 *     | psql "$DATABASE_URL"
 *
 * Refuses production environments and non-local databases (see src/lib/family/fixture-import.ts).
 * Everything imported is labelled fictional; posts stay drafts and the book stays unpublished.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertFixtureImportAllowed, buildFixtureSql, FixtureImportRefused, validateFixture } from "../../src/lib/family/fixture-import";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

try {
  assertFixtureImportAllowed(process.env, process.env.DATABASE_URL);
  const file = path.resolve(__dirname, "../../reference/build-pack-v3/content/birthday-demo.json");
  const fixture: unknown = JSON.parse(readFileSync(file, "utf8"));
  validateFixture(fixture);
  const curator = arg("curator");
  if (!curator) throw new FixtureImportRefused("Pass --curator <uuid of an existing local auth user>.");
  process.stdout.write(buildFixtureSql(fixture, { curatorUserId: curator, viewerUserId: arg("viewer") }));
} catch (e) {
  console.error(e instanceof FixtureImportRefused ? `Refused: ${e.message}` : e);
  process.exit(1);
}
