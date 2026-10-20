"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "./AppProvider";

export function StartOptions() {
  const { act, busy, catalog } = useApp();
  const router = useRouter();
  const go = async (id: string) => { const r = await act("startPersona", { personaId: id }); if (r) router.push("/skills"); };
  const card = "press group block rounded-3xl border border-line bg-surface p-5 text-left card-surface hover:border-accent";
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/resume" className={`${card} md:col-span-1 ring-2 ring-accent/40`}>
          <span aria-hidden className="text-2xl">📄</span>
          <p className="mt-2 text-lg font-bold">Scan my resume</p>
          <p className="mt-1 text-sm text-muted">Fastest. We read it, show what to improve, and fill in your skills for you. Nothing is saved.</p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent">Recommended →</span>
        </Link>
        <Link href="/profile" className={card}>
          <span aria-hidden className="text-2xl">✍️</span>
          <p className="mt-2 text-lg font-bold">Answer a few questions</p>
          <p className="mt-1 text-sm text-muted">No resume at hand? Pick your last job and skills. About two minutes.</p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent">Start →</span>
        </Link>
        <button onClick={() => go("hafiz")} disabled={busy || !catalog} className={`${card} disabled:opacity-60`}>
          <span aria-hidden className="text-2xl">👤</span>
          <p className="mt-2 text-lg font-bold">Try as Hafiz</p>
          <p className="mt-1 text-sm text-muted">A made-up profile: 27, bank operations executive, laid off in November, 5 months left. See everything in one click.</p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent">Open demo →</span>
        </button>
      </div>
      {catalog && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          More made-up profiles:
          {catalog.personas.filter((p) => p.id !== "hafiz").map((p) => (
            <button key={p.id} onClick={() => go(p.id)} className="press min-h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-surface2">{p.name}</button>
          ))}
        </p>
      )}
    </div>
  );
}
