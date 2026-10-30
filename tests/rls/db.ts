import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

// Keep timestamptz as the exact string Postgres sends (microseconds intact),
// the same way PostgREST hands it to the client, so feed cursors round-trip.
pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(20, (v) => Number(v)); // bigint counts

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

// Hosted Supabase blocks SQL deletes on storage tables (storage.protect_delete)
// unless the session opts in. The tests only write object metadata rows, never
// files, so opting in is safe; RLS still applies once a test switches role.
pool.on("connect", (c) => {
  c.query("select set_config('storage.allow_delete_query', 'true', false)").catch(() => {});
});

export type Client = pg.PoolClient;

const created: string[] = [];

/** Random valid username (<= 20 chars). */
export function uname(prefix = "u"): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`.slice(0, 20);
}

export interface CreateUserOpts {
  email?: string;
  name?: string;
  avatarUrl?: string;
  picture?: string;
}

/** Inserts into auth.users as superuser; the profile trigger creates the profile. */
export async function createUser(opts: CreateUserOpts = {}): Promise<string> {
  const id = randomUUID();
  const meta: Record<string, string> = {};
  if (opts.name !== undefined) meta.full_name = opts.name;
  if (opts.avatarUrl !== undefined) meta.avatar_url = opts.avatarUrl;
  if (opts.picture !== undefined) meta.picture = opts.picture;
  await pool.query(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, $4)`,
    [
      id,
      opts.email ?? `${id}@test.local`,
      JSON.stringify(meta),
      JSON.stringify({ provider: "google", providers: ["google"] }),
    ],
  );
  created.push(id);
  return id;
}

/**
 * Runs fn in a transaction as the given user (role authenticated + JWT
 * claims). Rolls back unless commit is set. Pass null for an anon session.
 */
export async function asUser<T>(
  uid: string | null,
  fn: (c: Client) => Promise<T>,
  opts: { commit?: boolean } = {},
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (uid) {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
    } else {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "anon" }),
      ]);
    }
    const out = await fn(c);
    await c.query(opts.commit ? "commit" : "rollback");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const asAnon = <T>(fn: (c: Client) => Promise<T>) => asUser(null, fn);

/** Single query as a user, rolled back. */
export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(
  uid: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return asUser(uid, async (c) => (await c.query<T>(sql, params)).rows);
}

/** Single query as a user, committed. */
export async function qc<T extends pg.QueryResultRow = pg.QueryResultRow>(
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return asUser(uid, async (c) => (await c.query<T>(sql, params)).rows, { commit: true });
}

export async function onboard(uid: string, username = uname(), displayName = "Test User") {
  const [row] = await qc(uid, "select * from public.complete_onboarding($1, $2)", [
    username,
    displayName,
  ]);
  return row as { id: string; username: string };
}

/** Created + onboarded user. */
export async function makeUser(prefix = "u") {
  const id = await createUser({ name: `${prefix} name` });
  const username = uname(prefix);
  await onboard(id, username, `${prefix} name`);
  return { id, username };
}

export async function sendRequest(from: string, to: string) {
  const [row] = await qc(from, "select * from public.send_friend_request($1)", [to]);
  return row as { id: string; status: string; requester_id: string; addressee_id: string };
}

export async function makeFriends(a: string, b: string) {
  await sendRequest(a, b);
  return sendRequest(b, a); // reverse request auto-accepts
}

/** Inserts a storage object row as the user (through storage RLS). */
export async function putObject(
  c: Client,
  bucket: string,
  name: string,
  meta: { mimetype?: string; size?: number } = {},
) {
  await c.query(
    `insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ($1, $2, (select auth.uid())::text, $3)`,
    [
      bucket,
      name,
      JSON.stringify({ mimetype: meta.mimetype ?? "image/webp", size: meta.size ?? 1234 }),
    ],
  );
}

export const LQIP = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

/** Uploads both objects for one media item and inserts the post_media row. */
export async function addMedia(c: Client, uid: string, postId: string, position: number) {
  const full = `${uid}/${postId}/${position}-full.webp`;
  const thumb = `${uid}/${postId}/${position}-thumb.webp`;
  await putObject(c, "post-media", full);
  await putObject(c, "post-media", thumb);
  const { rows } = await c.query(
    `insert into public.post_media (post_id, position, path_full, path_thumb, width, height, lqip, mime, bytes)
     values ($1, $2, $3, $4, 1200, 800, $5, 'image/webp', 1234) returning *`,
    [postId, position, full, thumb, LQIP],
  );
  return rows[0] as { id: string; path_full: string; path_thumb: string };
}

/** Creates a post as uid (optionally with media), published unless publish=false. */
export async function createPost(
  uid: string,
  opts: { body?: string; media?: number; publish?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await asUser(
    uid,
    async (c) => {
      await c.query("insert into public.posts (id, body) values ($1, $2)", [
        id,
        opts.body ?? "hello",
      ]);
      for (let i = 0; i < (opts.media ?? 0); i++) await addMedia(c, uid, id, i);
      if (opts.publish !== false) await c.query("select public.publish_post($1)", [id]);
    },
    { commit: true },
  );
  return id;
}

/** Deletes every user created in this test file (cascades to all content). */
export async function cleanup() {
  if (created.length) {
    await pool.query(
      "delete from storage.objects where split_part(name, '/', 1) = any($1::text[])",
      [created],
    );
    await pool.query("delete from auth.users where id = any($1::uuid[])", [created]);
    created.length = 0;
  }
  await pool.end();
}

/** Asserts a promise rejects with a pg error whose message matches. */
export async function rejects(p: Promise<unknown>, match: string | RegExp): Promise<void> {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error(`expected rejection matching ${String(match)}, but it resolved`);
  const msg = (err as Error).message;
  const ok = typeof match === "string" ? msg === match : match.test(msg);
  if (!ok) throw new Error(`expected error matching ${String(match)}, got: ${msg}`);
}

export const RLS_DENIED = /row-level security/;
export const PERMISSION_DENIED = /permission denied/;
