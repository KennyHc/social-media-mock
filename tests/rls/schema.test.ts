import { afterAll, describe, expect, it } from "vitest";
import { cleanup, pool } from "./db";

afterAll(cleanup);

describe("security posture", () => {
  it("every public table has RLS enabled", async () => {
    const { rows } = await pool.query(`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')`);
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const r of rows)
      expect({ table: r.relname, rls: r.relrowsecurity }).toEqual({ table: r.relname, rls: true });
  });

  it("anon has no privileges on public tables or functions", async () => {
    const tables = await pool.query(`
      select table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'`);
    expect(tables.rows).toEqual([]);
    const cols = await pool.query(`
      select table_name, column_name from information_schema.column_privileges
      where table_schema = 'public' and grantee = 'anon'`);
    expect(cols.rows).toEqual([]);
    const fns = await pool.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and (has_function_privilege('anon', p.oid, 'execute'))`);
    expect(fns.rows).toEqual([]);
  });

  it("every security definer function pins search_path = ''", async () => {
    const { rows } = await pool.query(`
      select n.nspname || '.' || p.proname as fn, p.proconfig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef`);
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) {
      expect({ fn: r.fn, config: r.proconfig }).toEqual({ fn: r.fn, config: ['search_path=""'] });
    }
  });

  it("read RPCs are security invoker", async () => {
    const { rows } = await pool.query(`
      select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('get_feed', 'get_user_posts', 'list_friends', 'list_friend_requests')`);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.prosecdef).toBe(false);
  });
});
