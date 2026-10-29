"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Shake, Skeleton, StaggerItem, StaggerList, toast, useShake } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { messageFor } from "@/features/auth/api";
import { useMe } from "@/features/auth/hooks";
import { useCompleteOnboarding, useUsernameAvailability } from "@/features/onboarding/hooks";
import { displayNameSchema } from "@/lib/validation";
import { haptic } from "@/motion/haptics";
import { duration } from "@/motion/tokens";
import { AvailabilityIndicator } from "./AvailabilityIndicator";

const AVATAR_SIZE = 96;

const extraErrors: Record<string, string> = {
  invalid_display_name: "Use 1–50 characters for your name.",
};

function errorText(error: { message?: string }) {
  const code = error.message?.trim() ?? "";
  return extraErrors[code] ?? messageFor(error);
}

export function OnboardingForm() {
  const router = useRouter();
  const me = useMe();
  const complete = useCompleteOnboarding();
  const { controls: formShake, shake: shakeForm } = useShake();
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [username, setUsername] = useState("");
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [blurred, setBlurred] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const displayName = nameEdit ?? me.data?.display_name ?? "";
  const availability = useUsernameAvailability(username);
  const nameParsed = displayNameSchema.safeParse(displayName);
  const nameValid = nameParsed.success;
  const nameTouched = nameEdit !== null;

  useEffect(() => () => {
    if (navTimer.current) clearTimeout(navTimer.current);
  }, []);

  const status = availability.status;
  const handle = username.trim();
  // Too short but otherwise valid: stay neutral until blur or a submit attempt.
  const tooShort = status === "invalid" && username.length < 3 && /^[a-z0-9_]*$/.test(username);
  const softHint = tooShort && !blurred && !attempted;
  let helper = "";
  let helperTone: "muted" | "danger" | "success" = "muted";
  if (serverError) {
    helper = serverError;
    helperTone = "danger";
  } else if (softHint) {
    helper = "3–20 characters: letters, numbers, underscores";
  } else if (status === "invalid") {
    helper = availability.message;
    helperTone = "danger";
  } else if (status === "available") {
    helper = `@${handle} is available`;
    helperTone = "success";
  } else if (status === "taken") {
    helper = `@${handle} is taken`;
    helperTone = "danger";
  } else if (status === "error") {
    helper = "Couldn't check right now";
    helperTone = "danger";
  }
  const isError = helperTone === "danger";
  const indicatorStatus = softHint ? "idle" : status;

  const submitting = complete.isPending;
  const done = complete.isSuccess;
  const canSubmit = status === "available" && nameValid && !submitting && !done;

  const onUsernameChange = (raw: string) => {
    setUsername(raw.replace(/^@+/, "").replace(/\s+/g, "").toLowerCase());
    if (serverError) setServerError(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    setServerError(null);
    complete.mutate(
      { username: handle.toLowerCase(), displayName: displayName.trim() },
      {
        onSuccess: () => {
          haptic("success");
          navTimer.current = setTimeout(() => {
            router.replace("/feed");
            router.refresh();
          }, duration.medium * 1000);
        },
        onError: (error) => {
          const message = errorText(error);
          setServerError(message);
          haptic("error");
          void shakeForm();
          toast.error(message);
        },
      },
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
        <motion.div animate={formShake}>
          <form onSubmit={onSubmit} noValidate>
            <StaggerList className="flex flex-col">
              <StaggerItem key="head" className="flex flex-col items-center text-center">
                <div className="mb-5" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
                  {me.isPending ? (
                    <Skeleton className="h-full w-full rounded-full" />
                  ) : (
                    <Avatar
                      src={me.data?.avatar_url}
                      name={displayName || me.data?.display_name}
                      size={AVATAR_SIZE}
                      priority
                    />
                  )}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Pick your username</h1>
                <p className="mt-2 text-sm text-fg-muted">
                  This is how friends find you. You can&apos;t change it later.
                </p>
              </StaggerItem>

              <StaggerItem key="username" className="mt-8">
                <Input
                  id="username"
                  label="Username"
                  prefix="@"
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  onBlur={() => setBlurred(true)}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  placeholder="yourname"
                  invalid={isError}
                  aria-describedby="username-help"
                  trailing={<AvailabilityIndicator status={indicatorStatus} serverError={Boolean(serverError)} />}
                />
                <Shake trigger={isError ? "error" : 0} className="min-h-5 pt-1.5">
                  <p
                    id="username-help"
                    aria-live="polite"
                    className={
                      "text-sm " +
                      (helperTone === "danger"
                        ? "text-danger"
                        : helperTone === "success"
                          ? "text-success"
                          : "text-fg-muted")
                    }
                  >
                    {helper}
                  </p>
                </Shake>
              </StaggerItem>

              <StaggerItem key="name" className="mt-4">
                <Input
                  id="display-name"
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setNameEdit(e.target.value)}
                  maxLength={50}
                  autoComplete="name"
                  placeholder="Your name"
                  invalid={nameTouched && !nameValid}
                  aria-describedby="display-name-help"
                />
                <p
                  id="display-name-help"
                  aria-live="polite"
                  className="min-h-5 pt-1.5 text-sm text-danger"
                >
                  {nameTouched && !nameParsed.success ? nameParsed.error.issues[0]?.message : ""}
                </p>
              </StaggerItem>

              <StaggerItem key="submit" className="mt-6">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={!canSubmit && !submitting && !done}
                  state={submitting ? "loading" : done ? "success" : "idle"}
                  announce={{ loading: "Saving", success: "Saved" }}
                >
                  Continue
                </Button>
              </StaggerItem>
            </StaggerList>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
