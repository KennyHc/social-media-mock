import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";
import {
  PERMISSION_DENIED,
  RLS_DENIED,
  addMedia,
  asUser,
  cleanup,
  createPost,
  createUser,
  makeFriends,
  makeUser,
  pool,
  q,
  qc,
  rejects,
  sendRequest,
} from "./db";

afterAll(cleanup);

// A-B friends, A->C pending, D stranger, E friend of A only.
let A: string, B: string, C: string, D: string, E: string;
let pA: string; // A, published, 1 media
let uA: string; // A, uploading, 1 media
let pB: string; // B, published
let pD: string; // D, published
let cB: string; // B's comment on pA

beforeAll(async () => {
  [A, B, C, D, E] = (await Promise.all(["a", "b", "c", "d", "e"].map((p) => makeUser(p)))).map(
    (u) => u.id,
  );
  await makeFriends(A, B);
  await makeFriends(A, E);
  await sendRequest(A, C);

  pA = await createPost(A, { body: "A published", media: 1 });
  uA = await createPost(A, { body: "A draft", media: 1, publish: false });
  pB = await createPost(B, { body: "B published" });
  pD = await createPost(D, { body: "D published" });

  await qc(A, "insert into public.likes (post_id) values ($1)", [pA]);
  await qc(B, "insert into public.likes (post_id) values ($1)", [pA]);
  cB = (
    await qc(B, "insert into public.comments (post_id, body) values ($1, 'nice') returning id", [
      pA,
    ])
  )[0].id;
});

const ids = (rows: QueryResultRow[]) => rows.map((r) => String(r.id)).sort();

describe("visibility matrix", () => {
  it("profiles: self, friends and pending counterparts only", async () => {
    const sel = (v: string) =>
      q<{ id: string }>(v, "select id from public.profiles where id = any($1)", [[A, B, C, D, E]]);
    expect(ids(await sel(A))).toEqual([A, B, C, E].sort());
    expect(ids(await sel(B))).toEqual([A, B].sort());
    expect(ids(await sel(C))).toEqual([A, C].sort());
    expect(ids(await sel(D))).toEqual([D]);
  });

  it("posts: own (any status) and friends' published only", async () => {
    const sel = (v: string) =>
      q<{ id: string }>(v, "select id from public.posts where id = any($1)", [[pA, uA, pB, pD]]);
    expect(ids(await sel(A))).toEqual([pA, uA, pB].sort());
    expect(ids(await sel(B))).toEqual([pA, pB].sort());
    expect(ids(await sel(C))).toEqual([]);
    expect(ids(await sel(D))).toEqual([pD]);
    expect(ids(await sel(E))).toEqual([pA]);
  });

  it("post_media: follows post visibility (draft media hidden from friends)", async () => {
    const sel = (v: string, post: string) =>
      q(v, "select id from public.post_media where post_id = $1", [post]);
    expect(await sel(A, pA)).toHaveLength(1);
    expect(await sel(A, uA)).toHaveLength(1);
    expect(await sel(B, pA)).toHaveLength(1);
    expect(await sel(B, uA)).toHaveLength(0);
    expect(await sel(C, pA)).toHaveLength(0);
    expect(await sel(D, pA)).toHaveLength(0);
  });

  it("likes and comments: visible only on visible posts", async () => {
    for (const [v, n] of [
      [A, 2],
      [B, 2],
      [E, 2],
      [C, 0],
      [D, 0],
    ] as const) {
      expect(await q(v, "select * from public.likes where post_id = $1", [pA])).toHaveLength(n);
      expect(await q(v, "select * from public.comments where post_id = $1", [pA])).toHaveLength(
        n ? 1 : 0,
      );
    }
  });

  it("get_feed: own + friends' published posts with counts and media", async () => {
    const feed = (v: string) => q(v, "select * from public.get_feed()");
    const a = await feed(A);
    expect(ids(a)).toEqual([pA, pB].sort());
    const rowA = a.find((r) => r.id === pA)!;
    expect(rowA).toMatchObject({
      like_count: 2,
      comment_count: 1,
      liked_by_me: true,
      status: "published",
    });
    expect(rowA.author).toMatchObject({ id: A, display_name: "a name" });
    expect(rowA.media).toHaveLength(1);
    expect(Object.keys(rowA.media[0]).sort()).toEqual(
      ["height", "id", "lqip", "path_full", "path_thumb", "position", "width"].sort(),
    );
    expect(ids(await feed(B))).toEqual([pA, pB].sort());
    expect(ids(await feed(E))).toEqual([pA]);
    expect((await feed(E))[0].liked_by_me).toBe(false);
    expect(ids(await feed(C))).toEqual([]);
    expect(ids(await feed(D))).toEqual([pD]);
  });

  it("get_user_posts: friends see published only, others nothing", async () => {
    const up = (v: string, u: string) => q(v, "select * from public.get_user_posts($1)", [u]);
    expect(ids(await up(A, A))).toEqual([pA]);
    expect(ids(await up(B, A))).toEqual([pA]);
    expect(ids(await up(C, A))).toEqual([]);
    expect(ids(await up(D, A))).toEqual([]);
    expect(ids(await up(A, D))).toEqual([]);
  });

  it("get_comments: author info even when commenter is not the viewer's friend", async () => {
    const rows = await q(E, "select * from public.get_comments($1)", [pA]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: cB, body: "nice", can_delete: false });
    expect(rows[0].author).toMatchObject({ id: B });
    expect((await q(A, "select * from public.get_comments($1)", [pA]))[0].can_delete).toBe(true);
    expect((await q(B, "select * from public.get_comments($1)", [pA]))[0].can_delete).toBe(true);
    expect(await q(D, "select * from public.get_comments($1)", [pA])).toHaveLength(0);
    expect(await q(C, "select * from public.get_comments($1)", [pA])).toHaveLength(0);
  });

  it("anon can read nothing", async () => {
    for (const t of [
      "profiles",
      "posts",
      "post_media",
      "likes",
      "comments",
      "friendships",
      "reserved_usernames",
    ]) {
      await rejects(q(null, `select * from public.${t} limit 1`), PERMISSION_DENIED);
    }
    await rejects(q(null, "select * from public.get_feed()"), PERMISSION_DENIED);
  });

  it("reserved_usernames is not readable by authenticated", async () => {
    await rejects(q(A, "select * from public.reserved_usernames"), PERMISSION_DENIED);
  });
});

describe("writes", () => {
  it("cannot insert posts as another user or already published", async () => {
    await rejects(
      q(A, "insert into public.posts (author_id, body) values ($1, 'x')", [B]),
      RLS_DENIED,
    );
    await rejects(
      q(A, "insert into public.posts (body, status) values ('x', 'published')"),
      RLS_DENIED,
    );
    await rejects(
      q(A, "insert into public.posts (body, published_at) values ('x', now())"),
      PERMISSION_DENIED,
    );
    const [row] = await q(
      A,
      "insert into public.posts (body) values ('ok') returning author_id, status",
    );
    expect(row).toMatchObject({ author_id: A, status: "uploading" });
  });

  it("cannot update posts directly; publish via RPC only by the author", async () => {
    await rejects(
      q(A, "update public.posts set body = 'edit' where id = $1", [pA]),
      PERMISSION_DENIED,
    );
    await rejects(
      q(A, "update public.posts set status = 'published' where id = $1", [uA]),
      PERMISSION_DENIED,
    );
    await rejects(q(B, "select public.publish_post($1)", [uA]), "not_found");
  });

  it("publish_post rejects empty posts", async () => {
    await asUser(A, async (c) => {
      const { rows } = await c.query("insert into public.posts (body) values ('   ') returning id");
      await rejects(c.query("select public.publish_post($1)", [rows[0].id]), "empty_post");
    });
  });

  it("publish_post accepts an empty body when media exists", async () => {
    await asUser(A, async (c) => {
      const { rows } = await c.query("insert into public.posts (body) values ('') returning id");
      await addMedia(c, A, rows[0].id, 0);
      const r = await c.query("select (public.publish_post($1)).*", [rows[0].id]);
      expect(r.rows[0].status).toBe("published");
    });
  });

  it("only the author can delete a post", async () => {
    expect(await q(B, "delete from public.posts where id = $1 returning id", [pA])).toHaveLength(0);
    expect(await q(A, "delete from public.posts where id = $1 returning id", [pA])).toHaveLength(1);
  });

  it("likes: only as self, only on visible published posts", async () => {
    await rejects(
      q(A, "insert into public.likes (post_id, user_id) values ($1, $2)", [pB, B]),
      RLS_DENIED,
    );
    await rejects(q(D, "insert into public.likes (post_id) values ($1)", [pA]), RLS_DENIED); // stranger
    await rejects(q(C, "insert into public.likes (post_id) values ($1)", [pA]), RLS_DENIED); // pending
    await rejects(q(B, "insert into public.likes (post_id) values ($1)", [uA]), RLS_DENIED); // draft
    await rejects(q(A, "insert into public.likes (post_id) values ($1)", [uA]), RLS_DENIED); // own draft
    expect(
      await q(E, "insert into public.likes (post_id) values ($1) returning *", [pA]),
    ).toHaveLength(1);
    // delete own only
    expect(
      await q(A, "delete from public.likes where post_id = $1 and user_id = $2 returning *", [
        pA,
        B,
      ]),
    ).toHaveLength(0);
    expect(
      await q(B, "delete from public.likes where post_id = $1 returning *", [pA]),
    ).toHaveLength(1);
  });

  it("comments: only as self, only on visible published posts, no updates", async () => {
    await rejects(
      q(A, "insert into public.comments (post_id, author_id, body) values ($1, $2, 'x')", [pB, B]),
      RLS_DENIED,
    );
    await rejects(
      q(D, "insert into public.comments (post_id, body) values ($1, 'x')", [pA]),
      RLS_DENIED,
    );
    await rejects(
      q(C, "insert into public.comments (post_id, body) values ($1, 'x')", [pA]),
      RLS_DENIED,
    );
    await rejects(
      q(B, "insert into public.comments (post_id, body) values ($1, 'x')", [uA]),
      RLS_DENIED,
    );
    await rejects(
      q(B, "insert into public.comments (post_id, body) values ($1, '   ')", [pA]),
      /check constraint/,
    );
    await rejects(
      q(B, "update public.comments set body = 'edited' where id = $1", [cB]),
      PERMISSION_DENIED,
    );
    expect(
      await q(E, "insert into public.comments (post_id, body) values ($1, 'hi') returning *", [pA]),
    ).toHaveLength(1);
  });

  it("profiles: own display_name/avatar only; username and others' rows immutable", async () => {
    expect(
      await q(A, "update public.profiles set display_name = 'New' where id = $1 returning id", [A]),
    ).toHaveLength(1);
    expect(
      await q(
        A,
        "update public.profiles set avatar_path = 'x/y.webp', avatar_url = null where id = $1 returning id",
        [A],
      ),
    ).toHaveLength(1);
    expect(
      await q(A, "update public.profiles set display_name = 'Hacked' where id = $1 returning id", [
        B,
      ]),
    ).toHaveLength(0);
    await rejects(
      q(A, "update public.profiles set username = 'renamed' where id = $1", [A]),
      PERMISSION_DENIED,
    );
    await rejects(
      q(A, "update public.profiles set onboarded_at = null where id = $1", [A]),
      PERMISSION_DENIED,
    );
    await rejects(
      q(A, "insert into public.profiles (id) values (gen_random_uuid())"),
      PERMISSION_DENIED,
    );
    await rejects(q(A, "delete from public.profiles where id = $1", [A]), PERMISSION_DENIED);
  });
});

describe("get_likers", () => {
  it("lists likers of a visible post, newest first", async () => {
    const rows = await q(A, "select * from public.get_likers($1)", [pA]);
    expect(rows.map((r) => r.id).sort()).toEqual([A, B].sort());
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["avatar_url", "created_at", "display_name", "id", "username"].sort(),
    );
    for (let i = 1; i < rows.length; i++)
      expect(new Date(rows[i - 1].created_at) >= new Date(rows[i].created_at)).toBe(true);
  });

  it("includes a liker who is the author's friend but not the viewer's", async () => {
    // E is friends with A only; B's profile is not readable by E via RLS
    expect(await q(E, "select id from public.profiles where id = $1", [B])).toHaveLength(0);
    const rows = await q(E, "select * from public.get_likers($1)", [pA]);
    expect(rows.find((r) => r.id === B)).toMatchObject({ display_name: "b name" });
  });

  it("returns nothing to strangers, pending counterparts or for drafts", async () => {
    expect(await q(D, "select * from public.get_likers($1)", [pA])).toHaveLength(0);
    expect(await q(C, "select * from public.get_likers($1)", [pA])).toHaveLength(0);
    expect(await q(B, "select * from public.get_likers($1)", [uA])).toHaveLength(0);
  });
});

describe("onboarding required to write", () => {
  it("un-onboarded users cannot create posts, likes or comments", async () => {
    const n = await createUser({ name: "Newbie" });
    // superuser-made friendship so A's post is visible to n
    await pool.query(
      "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ($1, $2, 'accepted', now())",
      [A, n],
    );
    expect(await q(n, "select id from public.posts where id = $1", [pA])).toHaveLength(1);
    await rejects(q(n, "insert into public.posts (body) values ('hi')"), RLS_DENIED);
    await rejects(q(n, "insert into public.likes (post_id) values ($1)", [pA]), RLS_DENIED);
    await rejects(
      q(n, "insert into public.comments (post_id, body) values ($1, 'hi')", [pA]),
      RLS_DENIED,
    );
  });
});

describe("comment delete", () => {
  it("comment author can delete their own comment", async () => {
    expect(await q(B, "delete from public.comments where id = $1 returning id", [cB])).toHaveLength(
      1,
    );
  });

  it("post author can delete others' comments on their post", async () => {
    expect(await q(A, "delete from public.comments where id = $1 returning id", [cB])).toHaveLength(
      1,
    );
  });

  it("a third party cannot, even if they can see it", async () => {
    expect(await q(E, "delete from public.comments where id = $1 returning id", [cB])).toHaveLength(
      0,
    );
    expect(await q(D, "delete from public.comments where id = $1 returning id", [cB])).toHaveLength(
      0,
    );
  });

  it("commenter cannot delete the post author's comments", async () => {
    const [own] = await qc(
      A,
      "insert into public.comments (post_id, body) values ($1, 'mine') returning id",
      [pA],
    );
    expect(
      await q(B, "delete from public.comments where id = $1 returning id", [own.id]),
    ).toHaveLength(0);
  });
});
