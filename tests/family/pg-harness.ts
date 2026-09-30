/**
 * Throwaway local Postgres 16 cluster for family RLS integration tests.
 *
 * initdb's a cluster in a temp directory, starts it on a free port, applies a minimal Supabase
 * emulation (tests/family/supabase-shim.sql) and then every migration in supabase/migrations in
 * filename order. When the tests run as root, the server processes run as the `postgres` OS user
 * (Postgres refuses to run as root) using Node's spawn uid/gid options.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chownSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(__dirname, "..", "..");

function findBinDir(): string | null {
  const candidates = [process.env.PG_BIN, "/usr/lib/postgresql/16/bin", "/usr/local/pgsql/bin", "/opt/homebrew/opt/postgresql@16/bin"];
  for (const c of candidates) if (c && existsSync(path.join(c, "initdb")) && existsSync(path.join(c, "pg_ctl"))) return c;
  try {
    const dir = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
    if (existsSync(path.join(dir, "initdb"))) return dir;
  } catch {
    /* not installed */
  }
  return null;
}

function osUser(): { uid: number; gid: number } | undefined {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return undefined;
  try {
    const uid = Number(execFileSync("id", ["-u", "postgres"], { encoding: "utf8" }).trim());
    const gid = Number(execFileSync("id", ["-g", "postgres"], { encoding: "utf8" }).trim());
    if (Number.isFinite(uid) && Number.isFinite(gid)) return { uid, gid };
  } catch {
    /* no postgres user */
  }
  return undefined;
}

/** Why the family integration tests cannot run here, or null when they can. */
export function postgresUnavailableReason(): string | null {
  if (process.env.WC_SKIP_PG === "1") return "WC_SKIP_PG=1";
  if (!findBinDir()) return "Postgres binaries (initdb/pg_ctl) not found; set PG_BIN";
  if (typeof process.getuid === "function" && process.getuid() === 0 && !osUser()) return "running as root without a postgres OS user";
  return null;
}

function run(bin: string, args: string[], user: { uid: number; gid: number } | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], ...(user ?? {}), env: { ...process.env, LC_ALL: "C" } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exited ${code}: ${out}`))));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export interface TestCluster {
  client: pg.Client;
  stop(): Promise<void>;
}

export async function startCluster(): Promise<TestCluster> {
  const bin = findBinDir();
  if (!bin) throw new Error("Postgres binaries not found");
  const user = osUser();
  const dir = mkdtempSync(path.join(tmpdir(), "wc-family-pg-"));
  if (user) chownSync(dir, user.uid, user.gid);
  const data = path.join(dir, "data");
  await run(path.join(bin, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-sync", "--no-instructions"], user);
  const port = await freePort();
  await run(
    path.join(bin, "pg_ctl"),
    ["-D", data, "-l", path.join(dir, "server.log"), "-w", "-o", `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off`, "start"],
    user,
  );
  const client = new pg.Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await client.connect();
  try {
    await client.query(readFileSync(path.join(__dirname, "supabase-shim.sql"), "utf8"));
    for (const file of migrationFiles()) await client.query(readFileSync(file, "utf8"));
  } catch (e) {
    await client.end().catch(() => {});
    await run(path.join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], user).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return {
    client,
    async stop() {
      await client.end().catch(() => {});
      await run(path.join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], user).catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function migrationFiles(): string[] {
  const dir = path.join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

export interface Actor {
  id: string | null;
  label: string;
}

export interface QueryError {
  code: string;
  message: string;
}

/**
 * Run statements as an API caller: role `authenticated` (or `anon` when id is null) with
 * request.jwt.claims set, inside a transaction that commits on success and rolls back on error.
 */
export async function asActor<T>(
  client: pg.Client,
  actor: Actor,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: QueryError }> {
  await client.query("begin");
  try {
    await client.query(`set local role ${actor.id ? "authenticated" : "anon"}`);
    const claims = actor.id ? { sub: actor.id, role: "authenticated" } : { role: "anon" };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const value = await fn((sql, params) => client.query(sql, params as unknown[]));
    await client.query("commit");
    return { ok: true, value };
  } catch (e) {
    await client.query("rollback");
    const err = e as { code?: string; message?: string };
    return { ok: false, error: { code: err.code ?? "unknown", message: err.message ?? String(e) } };
  }
}
