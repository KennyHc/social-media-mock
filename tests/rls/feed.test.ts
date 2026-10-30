import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, cleanup, createPost, makeFriends, makeUser, q, qc } from "./db";

afterAll(cleanup);

let F: string, G: string, S: string;
const fIds: string[] = [];
const gIds: string[] = [];

beforeAll(async () => {
  [F, G, S] = (await Promise.all(["f", "g", "s"].map((p) => makeUser(p)))).map((u) => u.id);
  await makeFriends(F, G);
  // 12 posts published in ONE transaction share published_at -> id tie-break.
  await asUser(
    F,
    async (c) => {
      for (let i = 0; i < 12; i++) {
        const id = randomUUID();
        await c.query("insert into public.posts (id, body) values ($1, $2)", [id, `same-ts ${i}`]);
        await c.query("select public.publish_post($1)", [id]);
        fIds.push(id);
      }
    },
    { commit: true },
  );
  for (let i = 0; i < 8; i++) fIds.push(await createPost(F, { body: `f ${i}` }));
  for (let i = 0; i < 11; i++) gIds.push(await createPost(G, { body: `g ${i}` }));
  await createPost(F, { body: "draft", publish: false }); // never in the feed
  await createPost(S, { body: "stranger" }); // never in F's feed
});

type Row = { id: string; published_at: string };

async function pageAll(viewer: string, fn: string, size: number, extra: unknown[] = []) {
  const all: Row[] = [];
  let cursor: [string | null, string | null] = [null, null];
  for (let guard = 0; guard < 100; guard++) {
    const args = [...extra, cursor[0], cursor[1], size];
    const ph = args.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await q<Row>(viewer, `select id, published_at from public.${fn}(${ph})`, args);
    expect(rows.length).toBeLessThanOrEqual(size);
    if (rows.length === 0) break;
    all.push(...rows);
    const last = rows[rows.length - 1];
    cursor = [last.published_at, last.id];
  }
  return all;
}

function assertStrictlyDescending(rows: Row[]) {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const ta = new Date(a.published_at).getTime();
    const tb = new Date(b.published_at).getTime();
    expect(ta > tb || (ta === tb && a.id > b.id)).toBe(true);
  }
}

describe("feed pagination", () => {
  it("walks the whole feed with no duplicates or gaps", async () => {
    for (const size of [1, 5, 7, 30]) {
      const rows = await pageAll(F, "get_feed", size);
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort()).toEqual([...fIds, ...gIds].sort());
      assertStrictlyDescending(rows);
    }
  });

  it("matches the unpaginated order", async () => {
    const paged = await pageAll(G, "get_feed", 4);
    const full = await q<Row>(G, "select id, published_at from public.get_feed(null, null, 30)");
    expect(full).toHaveLength(30);
    expect(paged.slice(0, 30).map((r) => r.id)).toEqual(full.map((r) => r.id));
  });

  it("clamps page_size to 1..30", async () => {
    expect(await q(F, "select * from public.get_feed(null, null, 1000)")).toHaveLength(30);
    expect(await q(F, "select * from public.get_feed(null, null, 0)")).toHaveLength(1);
    expect(await q(F, "select * from public.get_feed(null, null, -5)")).toHaveLength(1);
    expect(await q(F, "select * from public.get_feed()")).toHaveLength(10);
  });

  it("get_user_posts paginates one author", async () => {
    const rows = await pageAll(G, "get_user_posts", 3, [F]);
    expect(rows.map((r) => r.id).sort()).toEqual([...fIds].sort());
    assertStrictlyDescending(rows);
    expect(await pageAll(S, "get_user_posts", 3, [F])).toHaveLength(0);
  });
});

describe("comment pagination", () => {
  it("pages 5 comments 2 at a time with no duplicates or gaps", async () => {
    const post = await createPost(F, { body: "discuss" });
    const made: string[] = [];
    for (let i = 0; i < 5; i++) {
      const author = i % 2 ? G : F;
      const [row] = await qc(
        author,
        "insert into public.comments (post_id, body) values ($1, $2) returning id",
        [post, `c${i}`],
      );
      made.push(row.id);
    }
    const seen: { id: string; created_at: string }[] = [];
    let cursor: [string | null, string | null] = [null, null];
    for (let guard = 0; guard < 10; guard++) {
      const rows = await q<{ id: string; created_at: string }>(
        G,
        "select id, created_at from public.get_comments($1, $2, $3, 2)",
        [post, cursor[0], cursor[1]],
      );
      expect(rows.length).toBeLessThanOrEqual(2);
      if (!rows.length) break;
      seen.push(...rows);
      // round-trip the cursor through a JS Date, as a browser client would
      const last = rows[rows.length - 1];
      cursor = [new Date(last.created_at).toISOString(), last.id];
    }
    const ids = seen.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...made].sort());
    for (let k = 1; k < seen.length; k++) {
      const ta = new Date(seen[k - 1].created_at).getTime();
      const tb = new Date(seen[k].created_at).getTime();
      expect(ta < tb || (ta === tb && seen[k - 1].id < seen[k].id)).toBe(true);
    }
    // stored at millisecond precision
    for (const r of seen) expect(r.created_at).not.toMatch(/\.\d{4,}/);
  });
});
