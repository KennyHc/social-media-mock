import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LQIP,
  RLS_DENIED,
  addMedia,
  asUser,
  cleanup,
  createPost,
  makeFriends,
  makeUser,
  pool,
  putObject,
  q,
  qc,
  rejects,
  type Client,
} from "./db";

afterAll(cleanup);

let A: string, B: string, D: string;
beforeAll(async () => {
  [A, B, D] = (await Promise.all(["a", "b", "d"].map((p) => makeUser(p)))).map((u) => u.id);
  await makeFriends(A, B);
});

const insertMedia = (
  c: Client,
  postId: string,
  position: number,
  full: string,
  thumb: string,
  owner?: string,
) =>
  c.query(
    `insert into public.post_media (post_id, owner_id, position, path_full, path_thumb, width, height, lqip, mime, bytes)
     values ($1, coalesce($6::uuid, auth.uid()), $2, $3, $4, 10, 10, $5, 'image/webp', 100)`,
    [postId, position, full, thumb, LQIP, owner ?? null],
  );

const newDraft = async (c: Client) => {
  const id = randomUUID();
  await c.query("insert into public.posts (id, body) values ($1, 'draft')", [id]);
  return id;
};

describe("post_media trigger", () => {
  it("accepts media whose objects exist under {owner}/{post}/", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const m = await addMedia(c, A, post, 0);
      expect(m.path_full.startsWith(`${A}/${post}/`)).toBe(true);
    });
  });

  it("rejects a missing storage object", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const full = `${A}/${post}/0.webp`;
      await putObject(c, "post-media", full);
      await rejects(insertMedia(c, post, 0, full, `${A}/${post}/missing.webp`), "not_found");
    });
  });

  it("rejects a wrong path prefix", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const other = await newDraft(c);
      // objects exist, but in another post's folder
      const full = `${A}/${other}/0.webp`;
      const thumb = `${A}/${other}/0t.webp`;
      await putObject(c, "post-media", full);
      await putObject(c, "post-media", thumb);
      await c.query("savepoint s");
      await rejects(insertMedia(c, post, 0, full, thumb), "not_allowed");
      await c.query("rollback to savepoint s");
      // bare folder with no file name
      await rejects(insertMedia(c, post, 0, `${A}/${post}/`, `${A}/${post}/`), "not_allowed");
    });
  });

  it("rejects objects with a disallowed mime type or size", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const gif = `${A}/${post}/0.gif`;
      const big = `${A}/${post}/big.webp`;
      const ok = `${A}/${post}/ok.webp`;
      await putObject(c, "post-media", gif, { mimetype: "image/gif" });
      await putObject(c, "post-media", big, { size: 8388609 });
      await putObject(c, "post-media", ok);
      await c.query("savepoint s");
      await rejects(insertMedia(c, post, 0, gif, ok), "not_allowed");
      await c.query("rollback to savepoint s");
      await rejects(insertMedia(c, post, 0, ok, big), "not_allowed");
    });
  });

  it("rejects an 11th photo", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      for (let i = 0; i < 10; i++) await addMedia(c, A, post, i);
      const full = `${A}/${post}/x.webp`;
      await putObject(c, "post-media", full);
      // position 10 violates the range check; reusing a position violates uniqueness;
      // a direct trigger check covers the count.
      await c.query("savepoint s");
      await rejects(insertMedia(c, post, 10, full, full), /check constraint|not_allowed/);
      await c.query("rollback to savepoint s");
      await rejects(insertMedia(c, post, 3, full, full), /not_allowed|duplicate key/);
    });
  });

  it("rejects the 11th row even if positions were bypassed (trigger count)", async () => {
    // Superuser drops the position constraints inside a rolled-back tx to
    // prove the trigger alone enforces the cap.
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("alter table public.post_media drop constraint post_media_position_key");
      await c.query("alter table public.post_media drop constraint post_media_position_check");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: A }),
      ]);
      const post = await newDraft(c);
      for (let i = 0; i < 11; i++) await putObject(c, "post-media", `${A}/${post}/${i}.webp`);
      for (let i = 0; i < 10; i++) {
        const n = `${A}/${post}/${i}.webp`;
        await insertMedia(c, post, 0, n, n);
      }
      const n = `${A}/${post}/10.webp`;
      await rejects(insertMedia(c, post, 0, n, n), "not_allowed");
    } finally {
      await c.query("rollback");
      c.release();
    }
  });

  it("rejects media after publish", async () => {
    const post = await createPost(A, { body: "published" });
    await asUser(A, async (c) => {
      await rejects(addMedia(c, A, post, 1), "not_allowed");
    });
  });

  it("rejects media on someone else's post (trigger: owner must be author)", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      // switch to B inside the same transaction so B can reference A's draft
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: B }),
      ]);
      const full = `${B}/${post}/0.webp`;
      await putObject(c, "post-media", full);
      await rejects(insertMedia(c, post, 0, full, full), "not_allowed");
    });
  });

  it("rejects media rows owned by someone else (RLS: owner_id = self)", async () => {
    const bPost = await createPost(B, { body: "b draft", publish: false });
    const full = `${B}/${bPost}/0.webp`;
    await asUser(B, (c) => putObject(c, "post-media", full), { commit: true });
    // trigger is satisfied (owner B = author B, path and object OK); RLS is not
    await asUser(A, async (c) => {
      await rejects(insertMedia(c, bPost, 0, full, full, B), RLS_DENIED);
    });
    await asUser(B, async (c) => {
      await insertMedia(c, bPost, 0, full, full, B);
    });
  });

  it("media rows cannot be deleted by clients (post delete cascades)", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const m = await addMedia(c, A, post, 0);
      await c.query("savepoint s");
      await rejects(
        c.query("delete from public.post_media where id = $1", [m.id]),
        /permission denied/,
      );
      await c.query("rollback to savepoint s");
      await c.query("delete from public.posts where id = $1", [post]);
      const { rows } = await c.query("select 1 from public.post_media where id = $1", [m.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it("media rows cannot be updated", async () => {
    await asUser(A, async (c) => {
      const post = await newDraft(c);
      const m = await addMedia(c, A, post, 0);
      await rejects(
        c.query("update public.post_media set width = 1 where id = $1", [m.id]),
        /permission denied/,
      );
    });
  });
});

describe("storage policies", () => {
  let post: string;
  let full: string;
  beforeAll(async () => {
    post = await createPost(A, { body: "with photo", media: 1 });
    full = `${A}/${post}/0-full.webp`;
  });

  const see = (v: string, name: string, bucket = "post-media") =>
    q(v, "select name from storage.objects where bucket_id = $1 and name = $2", [bucket, name]);

  it("post-media: draft objects are readable by the owner only", async () => {
    const draft = await createPost(A, { body: "draft", media: 1, publish: false });
    const name = `${A}/${draft}/0-full.webp`;
    expect(await see(A, name)).toHaveLength(1);
    expect(await see(B, name)).toHaveLength(0);
    expect(await see(D, name)).toHaveLength(0);
  });

  it("post-media: objects of a deleted post are not readable by friends", async () => {
    const gone = await createPost(A, { body: "to delete", media: 1 });
    const name = `${A}/${gone}/0-full.webp`;
    expect(await see(B, name)).toHaveLength(1);
    await qc(A, "delete from public.posts where id = $1", [gone]);
    // objects are still there (client cleans up storage), but unreadable
    const { rows } = await pool.query("select 1 from storage.objects where name = $1", [name]);
    expect(rows).toHaveLength(1);
    expect(await see(B, name)).toHaveLength(0);
  });

  it("post-media: path must match the post's author", async () => {
    // B uploads under B/<A's post id>/ -- not readable by anyone via A's post
    const name = `${B}/${post}/spoof.webp`;
    await asUser(B, (c) => putObject(c, "post-media", name), { commit: true });
    expect(await see(B, name)).toHaveLength(0);
    expect(await see(A, name)).toHaveLength(0);
  });

  it("post-media: owner and friend can select, stranger cannot", async () => {
    expect(await see(A, full)).toHaveLength(1);
    expect(await see(B, full)).toHaveLength(1);
    expect(await see(D, full)).toHaveLength(0);
  });

  it("post-media: non-uuid folder names return false instead of raising", async () => {
    await pool.query(
      "insert into storage.objects (bucket_id, name, metadata) values ('post-media', $1, '{}') on conflict do nothing",
      [`not-a-uuid/${A}.webp`],
    );
    try {
      expect(await see(A, `not-a-uuid/${A}.webp`)).toHaveLength(0);
      const all = await q(A, "select name from storage.objects where bucket_id = 'post-media'");
      expect(all.map((r) => r.name)).toContain(full);
      expect(all.map((r) => r.name)).not.toContain(`not-a-uuid/${A}.webp`);
    } finally {
      await pool.query("delete from storage.objects where name = $1", [`not-a-uuid/${A}.webp`]);
    }
  });

  it("post-media: cannot insert into another user's folder", async () => {
    await asUser(B, async (c) => {
      await rejects(putObject(c, "post-media", `${A}/${post}/evil.webp`), RLS_DENIED);
    });
    await asUser(B, async (c) => {
      await putObject(c, "post-media", `${B}/${randomUUID()}/ok.webp`);
    });
  });

  it("post-media: cannot update or delete others' objects", async () => {
    expect(
      await q(B, "update storage.objects set metadata = '{}' where name = $1 returning name", [
        full,
      ]),
    ).toHaveLength(0);
    expect(
      await q(B, "delete from storage.objects where name = $1 returning name", [full]),
    ).toHaveLength(0);
    expect(
      await q(A, "delete from storage.objects where name = $1 returning name", [full]),
    ).toHaveLength(1);
  });

  it("avatars: any authenticated user can read; write own folder only", async () => {
    const name = `${A}/avatar.webp`;
    await asUser(A, (c) => putObject(c, "avatars", name), { commit: true });
    expect(await see(D, name, "avatars")).toHaveLength(1);
    expect(await see(B, name, "avatars")).toHaveLength(1);
    await asUser(D, async (c) => {
      await rejects(putObject(c, "avatars", `${A}/evil.webp`), RLS_DENIED);
    });
    expect(
      await q(D, "delete from storage.objects where name = $1 returning name", [name]),
    ).toHaveLength(0);
    // anon has table privileges on storage.objects in Supabase; with no anon
    // policy it sees nothing
    expect(
      await q(null, "select * from storage.objects where bucket_id in ('avatars', 'post-media')"),
    ).toHaveLength(0);
  });

  it("buckets are private with the expected limits", async () => {
    const { rows } = await pool.query(
      "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('post-media','avatars') order by id",
    );
    expect(rows).toEqual([
      {
        id: "avatars",
        public: false,
        file_size_limit: 2097152,
        allowed_mime_types: ["image/webp", "image/jpeg", "image/png", "image/avif"],
      },
      {
        id: "post-media",
        public: false,
        file_size_limit: 8388608,
        allowed_mime_types: ["image/webp", "image/jpeg", "image/png", "image/avif"],
      },
    ]);
  });
});
