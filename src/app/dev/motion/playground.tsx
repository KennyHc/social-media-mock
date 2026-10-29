"use client";

import { AnimatePresence } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  AnimatedNumber,
  CheckmarkDraw,
  FadeIn,
  Modal,
  PressableScale,
  ProgressRing,
  Shake,
  Sheet,
  Skeleton,
  Splash,
  StaggerItem,
  StaggerList,
  Toaster,
  toast,
} from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ParticleBurst, celebrate, preloadCelebrate } from "@/features/celebrate";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const small = "secondary" as const;

export function MotionPlayground() {
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [count, setCount] = useState(42);
  const [progress, setProgress] = useState(0.2);
  const [done, setDone] = useState(false);
  const [ringError, setRingError] = useState(false);
  const [people, setPeople] = useState([1, 2, 3]);
  const [nextId, setNextId] = useState(4);
  const [burst, setBurst] = useState(0);
  const [splash, setSplash] = useState(0);
  const [fade, setFade] = useState(true);

  const simulate = () => {
    setDone(false);
    setRingError(false);
    setProgress(0);
    [0.3, 0.6, 0.85, 1].forEach((p, i) =>
      setTimeout(() => {
        setProgress(p);
        if (p === 1) setDone(true);
      }, (i + 1) * 500),
    );
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Motion playground</h1>
        <ThemeToggle />
      </header>

      <Section title="Toasts">
        <Button variant={small} size="sm" onClick={() => toast.success("Saved to your circle")}>Success</Button>
        <Button variant={small} size="sm" onClick={() => toast.error("Could not send request")}>Error</Button>
        <Button variant={small} size="sm" onClick={() => toast.info("Mia is online")}>Info</Button>
      </Section>

      <Section title="Overlays">
        <Button size="sm" onClick={() => setSheet(true)}>Open sheet</Button>
        <Button size="sm" variant={small} onClick={() => setModal(true)}>Open modal</Button>
      </Section>

      <Section title="Shake and FadeIn">
        <Shake trigger={shakeKey} className="rounded-xl bg-surface-2 px-4 py-2 text-sm">Shake me</Shake>
        <Button size="sm" variant="danger" onClick={() => setShakeKey((k) => k + 1)}>Shake</Button>
        <Button size="sm" variant="ghost" onClick={() => setFade((f) => !f)}>Toggle FadeIn</Button>
        <AnimatePresence>
          {fade && <FadeIn className="rounded-xl bg-surface-2 px-4 py-2 text-sm">Hello there</FadeIn>}
        </AnimatePresence>
      </Section>

      <Section title="AnimatedNumber">
        <AnimatedNumber value={count} className="text-3xl font-bold" live />
        <Button size="sm" variant={small} onClick={() => setCount((c) => c - 1)}>-1</Button>
        <Button size="sm" variant={small} onClick={() => setCount((c) => c + 1)}>+1</Button>
        <Button size="sm" variant={small} onClick={() => setCount((c) => c + 100)}>+100</Button>
      </Section>

      <Section title="ProgressRing and CheckmarkDraw">
        <ProgressRing progress={progress} done={done} error={ringError} />
        <Button size="sm" variant={small} onClick={simulate}>Simulate upload</Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setDone(false);
            setRingError(true);
            setProgress(0.5);
          }}
        >
          Fail
        </Button>
        <CheckmarkDraw size={32} />
      </Section>

      <Section title="StaggerList">
        <Button size="sm" onClick={() => { setPeople((p) => [nextId, ...p]); setNextId((n) => n + 1); }}>Add</Button>
        <div className="w-full">
          <StaggerList className="space-y-2">
            {people.map((id) => (
              <StaggerItem key={id} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
                Friend request {id}
                <Button size="sm" variant="ghost" onClick={() => setPeople((p) => p.filter((x) => x !== id))}>Decline</Button>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </Section>

      <Section title="Button states">
        <Button onClickAsync={async () => { await wait(1200); }}>Async success</Button>
        <Button
          variant="danger"
          onClickAsync={async () => {
            await wait(900);
            throw new Error("nope");
          }}
        >
          Async error
        </Button>
        <Button disabled>Disabled</Button>
        <PressableScale as="div" className="rounded-xl bg-surface-2 px-4 py-2 text-sm">Press me (div)</PressableScale>
      </Section>

      <Section title="Celebrate">
        <Button
          variant={small}
          onPointerEnter={preloadCelebrate}
          onClick={(e) => celebrate({ tier: "small", origin: e.currentTarget }).then((r) => r.reduced && toast.success("Done"))}
        >
          Small
        </Button>
        <Button
          onPointerEnter={preloadCelebrate}
          onClick={(e) => celebrate({ tier: "large", origin: e.currentTarget }).then((r) => r.reduced && toast.success("Done"))}
        >
          Large
        </Button>
        <div className="relative">
          <PressableScale
            type="button"
            aria-label="Like"
            onClick={() => setBurst((b) => b + 1)}
            className="grid size-11 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <span aria-hidden="true">{"♥"}</span>
          </PressableScale>
          <ParticleBurst trigger={burst} />
        </div>
      </Section>

      <Section title="Skeleton">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </Section>

      <Section title="Splash">
        <Button size="sm" variant={small} onClick={() => setSplash((s) => s + 1)}>Replay splash</Button>
        {splash > 0 && <Splash key={splash} force />}
      </Section>

      <Sheet open={sheet} onOpenChange={setSheet} title="Share to circle">
        <p className="mb-4 text-sm text-fg-muted">Drag me down, tap the backdrop or press Escape.</p>
        <Button onClick={() => setSheet(false)}>Done</Button>
      </Sheet>
      <Modal open={modal} onOpenChange={setModal} title="Remove friend?">
        <p className="mb-4 text-sm text-fg-muted">They will no longer see your posts.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => setModal(false)}>Remove</Button>
        </div>
      </Modal>
      <Toaster />
    </main>
  );
}
