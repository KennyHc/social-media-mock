import { describe, expect, it } from "vitest";
import { isNetworkError, makeQueryClient } from "@/lib/query/client";

describe("retry policy", () => {
  it("treats fetch/transport failures as retryable", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "NetworkError when attempting to fetch resource." })).toBe(true);
  });

  it("never retries a server answer (RLS denial or RPC error code)", () => {
    expect(isNetworkError({ code: "P0001", message: "not_allowed" })).toBe(false);
    expect(isNetworkError({ code: "42501", message: "permission denied for table posts" })).toBe(false);
  });

  it("wires the policy into mutations: one retry on network error, none otherwise", () => {
    const retry = makeQueryClient().getDefaultOptions().mutations?.retry as (
      n: number,
      e: unknown,
    ) => boolean;
    expect(retry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(retry(0, { message: "not_allowed" })).toBe(false);
  });
});
