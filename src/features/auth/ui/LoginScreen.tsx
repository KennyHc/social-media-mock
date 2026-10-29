"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { StaggerItem, StaggerList, useShake } from "@/components/motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/ui/Logo";
import { signInWithGoogle, messageFor } from "@/features/auth/api";
import { haptic } from "@/motion/haptics";
import { GoogleButton } from "./GoogleButton";

const AUTH_FAILED = "We couldn't sign you in. Please try again.";

/** Reads `?error=auth`. Must render inside a Suspense boundary. */
function LoginError({ signInError }: { signInError: string | null }) {
  const params = useSearchParams();
  const message = signInError ?? (params.get("error") ? AUTH_FAILED : null);
  const { controls, shake } = useShake();
  useEffect(() => {
    if (message) {
      haptic("error");
      void shake();
    }
  }, [message, shake]);
  return (
    <motion.div animate={controls} className="min-h-10 pt-3">
      <p role="alert" className="text-center text-sm text-danger">
        {message}
      </p>
    </motion.div>
  );
}

export function LoginScreen() {
  const [signInError, setSignInError] = useState<string | null>(null);

  const onGoogle = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setSignInError(messageFor(e as { message?: string }, AUTH_FAILED));
      throw e;
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <StaggerList className="flex flex-col items-center text-center">
          <StaggerItem key="logo" className="mb-5">
            <Logo size={72} />
          </StaggerItem>
          <StaggerItem key="title">
            <h1 className="text-4xl font-semibold tracking-tight">Circle</h1>
          </StaggerItem>
          <StaggerItem key="tagline" className="mt-2">
            <p className="text-base text-fg-muted">A private space for your closest friends.</p>
          </StaggerItem>
          <StaggerItem key="button" className="mt-10 w-full">
            <GoogleButton onClickAsync={onGoogle} />
            <Suspense fallback={<div className="min-h-10 pt-3" />}>
              <LoginError signInError={signInError} />
            </Suspense>
          </StaggerItem>
          <StaggerItem key="footnote" className="mt-6">
            <p className="text-xs text-fg-muted">Invite-only by friendship. No public profiles.</p>
          </StaggerItem>
        </StaggerList>
      </main>
    </div>
  );
}
