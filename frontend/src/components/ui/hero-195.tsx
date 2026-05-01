import { ArrowRight, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";

// Placeholder hero — built to match the project's shadcn theme using
// BorderBeam. Swap with the real `Hero195` source when available.

interface Hero195Props {
  className?: string;
  onPrimary?: () => void;
}

export const Hero195 = ({ className, onPrimary }: Hero195Props) => {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card px-6 py-12 sm:px-10 sm:py-16",
        className,
      )}
    >
      <BorderBeam size={250} duration={12} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, var(--gradient-1), var(--gradient-3), var(--gradient-1))",
        }}
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Personal finance, made simple
        </span>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Know where your money goes.
        </h1>
        <p className="mt-4 max-w-prose text-balance text-muted-foreground">
          Log expenses in seconds, filter by category, and see your running
          total at a glance. Built to work even on flaky networks.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onPrimary}>
            <Wallet className="mr-2 h-4 w-4" />
            Add an expense
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#expenses">View expenses</a>
          </Button>
        </div>
      </div>
    </section>
  );
};
