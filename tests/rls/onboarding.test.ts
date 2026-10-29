import { afterAll, describe, expect, it } from "vitest";
import { cleanup, createUser, onboard, pool, q, qc, rejects, uname } from "./db";

afterAll(cleanup);

const complete = (uid: string, username: string, displayName = "Name") =>
  qc(uid, "select * from public.complete_onboarding($1, $2)", [username, displayName]);

describe("profile trigger", () => {
  it("creates a profile from Google metadata (avatar_url)", async () => {
    const id = await createUser({ name: "  Ada Lovelace ", avatarUrl: "https://x/a.png" });
    const { rows } = await pool.query("select * from public.profiles where id = $1", [id]);
    expect(rows[0]).toMatchObject({
      username: null,
      display_name: "Ada Lovelace",
      avatar_url: "https://x/a.png",
      onboarded_at: null,
    });
  });

  it("falls back to picture and tolerates missing name", async () => {
    const id = await createUser({ picture: "https://x/p.png" });
    const { rows } = await pool.query("select * from public.profiles where id = $1", [id]);
    expect(rows[0]).toMatchObject({ display_name: null, avatar_url: "https://x/p.png" });
  });

  it("truncates long names to 50 chars", async () => {
    const id = await createUser({ name: "x".repeat(80) });
    const { rows } = await pool.query("select display_name from public.profiles where id = $1", [
      id,
    ]);
    expect(rows[0].display_name).toHaveLength(50);
  });
});

describe("username_available", () => {
  it("checks format, reserved names and taken names", async () => {
    const u = await createUser();
    const other = await createUser();
    const taken = uname("tk");
    await onboard(other, taken);
    const check = async (n: string) =>
      (await q(u, "select public.username_available($1) as ok", [n]))[0].ok;
    expect(await check(uname("free"))).toBe(true);
    expect(await check("ab")).toBe(false);
    expect(await check("a".repeat(21))).toBe(false);
    expect(await check("bad-name")).toBe(false);
    expect(await check("admin")).toBe(false);
    expect(await check("ADMIN")).toBe(false);
    expect(await check(taken)).toBe(false);
    expect(await check(taken.toUpperCase())).toBe(false);
  });

  it("is not callable by anon", async () => {
    await rejects(q(null, "select public.username_available('abc')"), /permission denied/);
  });
});

describe("complete_onboarding", () => {
  it("rejects invalid usernames", async () => {
    const u = await createUser();
    for (const bad of ["ab", "a".repeat(21), "has space", "dash-y", "émile", ""]) {
      await rejects(complete(u, bad), "invalid_username");
    }
  });

  it("rejects reserved names (case-insensitive)", async () => {
    const u = await createUser();
    await rejects(complete(u, "admin"), "username_reserved");
    await rejects(complete(u, "Support"), "username_reserved");
  });

  it("rejects bad display names", async () => {
    const u = await createUser();
    await rejects(complete(u, uname(), "   "), "invalid_display_name");
    await rejects(complete(u, uname(), "x".repeat(51)), "invalid_display_name");
  });

  it("normalizes case/whitespace, sets onboarded_at and app_metadata.onboarded", async () => {
    const u = await createUser();
    const name = uname("Norm").toUpperCase();
    const [row] = await complete(u, `  ${name} `, "  Grace  ");
    expect(row.username).toBe(name.toLowerCase());
    expect(row.display_name).toBe("Grace");
    expect(row.onboarded_at).not.toBeNull();
    const { rows } = await pool.query("select raw_app_meta_data from auth.users where id = $1", [
      u,
    ]);
    expect(rows[0].raw_app_meta_data).toMatchObject({ onboarded: true, provider: "google" });
  });

  it("rejects taken usernames, case-insensitively", async () => {
    const a = await createUser();
    const b = await createUser();
    const name = uname("dup");
    await complete(a, name);
    await rejects(complete(b, name), "username_taken");
    await rejects(complete(b, name.toUpperCase()), "username_taken");
  });

  it("rejects a second onboarding (usernames are immutable)", async () => {
    const u = await createUser();
    await complete(u, uname());
    await rejects(complete(u, uname()), "already_onboarded");
  });

  it("is not callable by anon", async () => {
    await rejects(q(null, "select public.complete_onboarding('abcd', 'x')"), /permission denied/);
  });
});
