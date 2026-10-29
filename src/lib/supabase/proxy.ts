import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
  (process.env.NODE_ENV !== "production" && path.startsWith("/dev"));

/**
 * Refreshes the Supabase session cookie and gates routes:
 * signed out -> /login; signed in but not onboarded -> /onboarding.
 * Onboarding state comes from the JWT's app_metadata.onboarded (set by the
 * complete_onboarding RPC), so this needs no database round trip.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  if (!env.supabaseUrl || !env.supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims verifies the JWT (locally when asymmetric keys are used) and refreshes if needed.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const onboarded = Boolean(
    (claims?.app_metadata as { onboarded?: boolean } | undefined)?.onboarded,
  );

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!claims) return isPublic(path) ? response : redirect("/login");
  if (!onboarded && path !== "/onboarding" && !path.startsWith("/auth") && !isPublic(path))
    return redirect("/onboarding");
  if (onboarded && (path === "/login" || path === "/onboarding" || path === "/"))
    return redirect("/feed");
  if (path === "/") return redirect(onboarded ? "/feed" : "/onboarding");

  return response;
}
