import { z } from "zod";

// Mirrors the database checks in supabase/migrations. Keep both in sync.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Tell your friends what to call you")
  .max(50, "At most 50 characters");

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
});

export const POST_BODY_MAX = 2000;
export const COMMENT_BODY_MAX = 1000;
export const MAX_PHOTOS = 10;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"] as const;
