import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PERMISSION_DENIED,
  cleanup,
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

const send = (from: string, to: string) =>
  qc(from, "select * from public.send_friend_request($1)", [to]);
const respond = (uid: string, requestId: string, accept: boolean) =>
  qc(uid, "select * from public.respond_friend_request($1, $2)", [requestId, accept]);
const remove = (uid: string, other: string) =>
  qc(uid, "select public.remove_friendship($1) as removed", [other]);
const rowsBetween = (viewer: string, other: string) =>
  q(
    viewer,
    `select * from public.friendships
     where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)`,
    [viewer, other],
  );

describe("friendship state machine", () => {
  it("send creates a pending request; duplicate is already_requested", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const [fr] = await send(a.id, b.id);
    expect(fr).toMatchObject({ requester_id: a.id, addressee_id: b.id, status: "pending" });
    await rejects(send(a.id, b.id), "already_requested");
  });

  it("reverse request auto-accepts; then already_friends both ways", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await send(a.id, b.id);
    const [fr] = await send(b.id, a.id);
    expect(fr.status).toBe("accepted");
    expect(fr.responded_at).not.toBeNull();
    await rejects(send(a.id, b.id), "already_friends");
    await rejects(send(b.id, a.id), "already_friends");
  });

  it("rejects self, unknown and un-onboarded targets", async () => {
    const a = await makeUser("a");
    const pending = await createUser();
    await rejects(send(a.id, a.id), "self");
    await rejects(send(a.id, "00000000-0000-0000-0000-000000000001"), "not_found");
    await rejects(send(a.id, pending), "not_found");
  });

  it("un-onboarded users cannot send requests", async () => {
    const a = await makeUser("a");
    const pending = await createUser();
    await rejects(send(pending, a.id), "not_allowed");
  });

  it("only the addressee can accept", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await makeUser("c");
    const fr = await sendRequest(a.id, b.id);
    await rejects(respond(a.id, fr.id, true), "not_allowed");
    await rejects(respond(c.id, fr.id, true), "not_found");
    const [acc] = await respond(b.id, fr.id, true);
    expect(acc.status).toBe("accepted");
    // accepted requests cannot be responded to again
    await rejects(respond(b.id, fr.id, true), "not_found");
  });

  it("decline deletes the row", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const fr = await sendRequest(a.id, b.id);
    await rejects(respond(a.id, fr.id, false), "not_allowed");
    await respond(b.id, fr.id, false);
    expect(await rowsBetween(a.id, b.id)).toHaveLength(0);
    // can request again after a decline
    expect((await send(a.id, b.id))[0].status).toBe("pending");
  });

  it("remove_friendship unfriends, cancels outgoing and declines incoming", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await makeUser("c");
    const d = await makeUser("d");
    await makeFriends(a.id, b.id);
    await sendRequest(a.id, c.id);
    await sendRequest(d.id, a.id);

    expect((await remove(a.id, b.id))[0].removed).toBe(true);
    expect((await remove(a.id, c.id))[0].removed).toBe(true);
    expect((await remove(a.id, d.id))[0].removed).toBe(true);
    expect((await remove(a.id, d.id))[0].removed).toBe(false);
    for (const o of [b, c, d]) expect(await rowsBetween(a.id, o.id)).toHaveLength(0);
  });

  it("remove_friendship cannot touch other people's rows", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const x = await makeUser("x");
    await makeFriends(a.id, b.id);
    // x tries to remove the a<->b friendship by naming one side
    expect((await remove(x.id, b.id))[0].removed).toBe(false);
    expect(await rowsBetween(a.id, b.id)).toHaveLength(1);
  });

  it("friendships cannot be written directly", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const fr = await sendRequest(a.id, b.id);
    await rejects(
      q(
        a.id,
        "insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')",
        [a.id, b.id],
      ),
      PERMISSION_DENIED,
    );
    await rejects(
      q(a.id, "update public.friendships set status = 'accepted' where id = $1", [fr.id]),
      PERMISSION_DENIED,
    );
    await rejects(
      q(b.id, "update public.friendships set status = 'accepted' where id = $1", [fr.id]),
      PERMISSION_DENIED,
    );
    await rejects(
      q(a.id, "delete from public.friendships where id = $1", [fr.id]),
      PERMISSION_DENIED,
    );
  });

  it("friendship rows are visible only to participants", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const x = await makeUser("x");
    await sendRequest(a.id, b.id);
    expect(await rowsBetween(a.id, b.id)).toHaveLength(1);
    expect(await rowsBetween(b.id, a.id)).toHaveLength(1);
    expect(
      await q(x.id, "select * from public.friendships where $1 in (requester_id, addressee_id)", [
        a.id,
      ]),
    ).toHaveLength(0);
  });

  it("is_friend is not callable by clients", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await rejects(q(a.id, "select public.is_friend($1, $2)", [a.id, b.id]), PERMISSION_DENIED);
  });
});

describe("list_friends / list_friend_requests", () => {
  let a: { id: string; username: string };
  let b: { id: string; username: string };
  let c: { id: string; username: string };
  let d: { id: string; username: string };
  beforeAll(async () => {
    a = await makeUser("a");
    b = await makeUser("b");
    c = await makeUser("c");
    d = await makeUser("d");
    await makeFriends(a.id, b.id);
    await sendRequest(a.id, c.id);
    await sendRequest(d.id, a.id);
  });

  it("lists accepted friends only", async () => {
    const rows = await q(a.id, "select * from public.list_friends()");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: b.id, username: b.username });
    expect(rows[0].since).toBeTruthy();
    expect((await q(b.id, "select * from public.list_friends()")).map((r) => r.id)).toEqual([a.id]);
    expect(await q(c.id, "select * from public.list_friends()")).toHaveLength(0);
  });

  it("lists incoming and outgoing requests", async () => {
    const rows = await q(a.id, "select * from public.list_friend_requests()");
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(rows).toHaveLength(2);
    expect(byId[c.id]).toMatchObject({ direction: "outgoing", username: c.username });
    expect(byId[d.id]).toMatchObject({ direction: "incoming", username: d.username });
    const cRows = await q(c.id, "select * from public.list_friend_requests()");
    expect(cRows).toHaveLength(1);
    expect(cRows[0]).toMatchObject({ direction: "incoming", id: a.id });
  });
});

describe("find_user_by_username", () => {
  let a: { id: string; username: string };
  let b: { id: string; username: string };
  let c: { id: string; username: string };
  let d: { id: string; username: string };
  let e: { id: string; username: string };
  beforeAll(async () => {
    a = await makeUser("a");
    b = await makeUser("b");
    c = await makeUser("c");
    d = await makeUser("d");
    e = await makeUser("e");
    await makeFriends(a.id, b.id);
    await sendRequest(a.id, c.id);
    await sendRequest(d.id, a.id);
  });
  const find = (viewer: string, name: string) =>
    q(viewer, "select * from public.find_user_by_username($1)", [name]);

  it("returns relationship values", async () => {
    expect((await find(a.id, a.username))[0].relationship).toBe("self");
    expect((await find(a.id, b.username))[0].relationship).toBe("friends");
    expect((await find(a.id, c.username))[0].relationship).toBe("outgoing");
    expect((await find(c.id, a.username))[0].relationship).toBe("incoming");
    expect((await find(a.id, d.username))[0].relationship).toBe("incoming");
    const [row] = await find(a.id, e.username);
    expect(row).toMatchObject({ id: e.id, username: e.username, relationship: "none" });
    expect(Object.keys(row).sort()).toEqual([
      "avatar_url",
      "display_name",
      "id",
      "relationship",
      "username",
    ]);
  });

  it("matches exactly and case-insensitively; partial matches return nothing", async () => {
    expect(await find(a.id, e.username.toUpperCase())).toHaveLength(1);
    expect(await find(a.id, ` ${e.username} `)).toHaveLength(1);
    expect(await find(a.id, e.username.slice(0, -1))).toHaveLength(0);
    expect(await find(a.id, `${e.username}x`)).toHaveLength(0);
    expect(await find(a.id, "e_%")).toHaveLength(0);
  });

  it("hides un-onboarded users", async () => {
    const pending = await createUser({ name: "Pending" });
    // give them a username without onboarded_at (simulates a partial state)
    await pool.query("update public.profiles set username = $2 where id = $1", [
      pending,
      `p_${pending.slice(0, 8)}`,
    ]);
    expect(await find(a.id, `p_${pending.slice(0, 8)}`)).toHaveLength(0);
  });

  it("is not callable by anon", async () => {
    await rejects(q(null, "select * from public.find_user_by_username('abc')"), PERMISSION_DENIED);
  });
});
