"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, H, PageTitle, Skeleton } from "@/components/ui";

export default function ProfilePage() {
  const { state, catalog } = useApp();
  if (!catalog || !state) return <Skeleton lines={5} />;
  return <ProfileForm key={state.profile?.personaId ?? "own"} />;
}

function ProfileForm() {
  const { state, catalog, act, busy, error } = useApp();
  const router = useRouter();
  const p = state!.profile;
  const cat = catalog!;
  const [occ, setOcc] = useState(p?.occupationId ?? cat.occupations[0].id);
  const [name, setName] = useState(p?.name ?? "");
  const [years, setYears] = useState(p?.years ?? 2);
  const [edu, setEdu] = useState<string>(p?.education ?? cat.occupations[0].education);
  const [skills, setSkills] = useState<string[]>(p?.skills ?? cat.occupations[0].skills);
  const [interests, setInterests] = useState<string[]>(p?.interests ?? []);
  const [months, setMonths] = useState(p?.months ?? 6);
  const [hours, setHours] = useState(p?.hoursPerWeek ?? 10);
  const [budget, setBudget] = useState<string>(p?.budget ?? "free");
  const inferred = useMemo(() => cat.occupations.find((o) => o.id === occ)?.skills ?? [], [cat, occ]);
  const catalog_ = cat;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const skillName = (id: string) => catalog_.skills.find((s) => s.id === id)!.name;
  const others = catalog_.skills.filter((s) => !inferred.includes(s.id));

  const submit = async () => {
    const r = await act("setProfile", { profile: { personaId: p?.personaId, name: name || "You", occupationId: occ, education: edu, years, skills, interests, months, hoursPerWeek: hours, budget, synthetic: !!p?.synthetic } });
    if (r) router.push("/skills");
  };

  return (
    <div>
      <PageTitle step="Step 1 of 4 · You" title={p?.synthetic ? `${p.name}'s profile` : "Your profile"}>
        A few questions so the forecast and plan fit you. We never ask for your age, gender or background, and they are never used.
      </PageTitle>
      {p?.synthetic && <div className="mb-4"><Chip tone="demo">Made-up profile for the demo · no real person</Chip></div>}
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Card className="space-y-4">
          <H>About your last job</H>
          <label className="block">
            <span className="text-sm font-medium">First name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3" placeholder="e.g. Hafiz" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">What was your previous job?</span>
            <select value={occ} onChange={(e) => { const o = catalog_.occupations.find((x) => x.id === e.target.value)!; setOcc(o.id); setSkills(o.skills); setEdu(o.education); }} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3">
              {catalog_.occupations.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Highest qualification</span>
            <select value={edu} onChange={(e) => setEdu(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3">
              {catalog_.education.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <span className="text-xs text-muted">Some jobs need a diploma or degree. This is never used for anything else.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Years of experience: <b className="num">{years}</b></span>
            <input type="range" min={0} max={20} value={years} onChange={(e) => setYears(+e.target.value)} />
          </label>
        </Card>

        <Card className="space-y-4">
          <H>Your time</H>
          <label className="block">
            <span className="text-sm font-medium">How many months do you have to find a new job? <b className="num">{months}</b></span>
            <input type="range" min={1} max={6} value={months} onChange={(e) => setMonths(+e.target.value)} />
            <span className="text-xs text-muted">Support for job seekers usually lasts 3 to 6 months. Runway only ranks jobs you can reach in this time.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Hours a week you can study: <b className="num">{hours}</b></span>
            <input type="range" min={2} max={30} value={hours} onChange={(e) => setHours(+e.target.value)} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Training budget</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {[["free", "Free only"], ["low", "Low cost is fine"], ["flexible", "Flexible"]].map(([v, l]) => (
                <label key={v} className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3 text-sm ${budget === v ? "border-accent bg-accentsoft font-semibold" : "border-line"}`}>
                  <input type="radio" name="budget" value={v} checked={budget === v} onChange={() => setBudget(v)} className="sr-only" />{l}
                </label>
              ))}
            </div>
            <span className="text-xs text-muted">Runway currently suggests free courses only.</span>
          </fieldset>
        </Card>

        <Card className="lg:col-span-2">
          <H sub="We inferred these from your last job. Untick any you do not have.">Skills you have</H>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inferred.map((id) => (
              <label key={id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${skills.includes(id) ? "border-accent bg-accentsoft" : "border-line"}`}>
                <input type="checkbox" checked={skills.includes(id)} onChange={() => setSkills(toggle(skills, id))} /> {skillName(id)}
              </label>
            ))}
          </div>
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">Other skills you may have ({others.length})</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => (
                <label key={s.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${skills.includes(s.id) ? "border-accent bg-accentsoft" : "border-line"}`}>
                  <input type="checkbox" checked={skills.includes(s.id)} onChange={() => setSkills(toggle(skills, s.id))} /> {s.name}
                </label>
              ))}
            </div>
          </details>
        </Card>

        <Card className="lg:col-span-2">
          <H sub="Pick up to three. They nudge the ranking a little; they never exclude a job.">What interests you?</H>
          <div className="flex flex-wrap gap-2">
            {catalog_.interests.map((i) => (
              <button type="button" key={i.id} aria-pressed={interests.includes(i.id)}
                onClick={() => setInterests(interests.includes(i.id) ? interests.filter((x) => x !== i.id) : interests.length < 3 ? [...interests, i.id] : interests)}
                className={`min-h-11 rounded-full border px-4 text-sm ${interests.includes(i.id) ? "border-accent bg-accent font-semibold text-accentink" : "border-line bg-surface"}`}>{i.label}</button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          {error && <p role="alert" className="mb-3 rounded-lg bg-fallsoft p-3 text-sm text-fall">{error}</p>}
          <Btn type="submit" disabled={busy || skills.length === 0} className="min-h-12 px-6 text-base">Show my skills&apos; shelf life →</Btn>
        </div>
      </form>
    </div>
  );
}
