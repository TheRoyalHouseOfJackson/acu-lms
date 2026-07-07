import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/Logo";
import type { Program } from "@/lib/types";
import { GraduationCap, BookOpen, Award, Clock, Quote, ArrowRight } from "lucide-react";

const LEVELS = [
  { name: "Bachelor's", icon: BookOpen, blurb: "Build a strong biblical and academic foundation.", count: 12 },
  { name: "Master's", icon: GraduationCap, blurb: "Deepen theological understanding and practical skill.", count: 12 },
  { name: "Doctoral", icon: Award, blurb: "Lead at the highest levels of scholarship and ministry.", count: 10 },
  { name: "Dual", icon: GraduationCap, blurb: "Earn two credentials on one accelerated pathway.", count: 4 },
];

export default function Home() {
  const { data: programs } = useQuery<Program[]>({ queryKey: ["/api/programs"] });

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(347_40%_24%)]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <div className="rounded-2xl bg-background/10 p-3 ring-1 ring-accent/40">
              <LogoMark size={64} />
            </div>
          </div>
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-accent">Ambassadors Christian University</p>
          <h1 className="mx-auto max-w-4xl font-serif text-5xl leading-[1.05] text-background sm:text-7xl">
            Preparing Servants<br />for the Kingdom
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-background/80">
            A private online Christian university offering 38 self-paced, faith-based degree programs —
            grounded in Scripture, shaped for real-world ministry, and available wherever God has planted you.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/programs">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-browse-programs">
                Browse Programs <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/apply">
              <Button size="lg" variant="outline" className="border-background/40 bg-transparent text-background hover:bg-background/10" data-testid="button-apply-hero">
                Apply Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { icon: BookOpen, value: "38", label: "Degree Programs" },
            { icon: Clock, value: "100%", label: "Self-Paced Online" },
            { icon: GraduationCap, value: "4", label: "Levels of Study" },
            { icon: Award, value: "Faith", label: "Centered Curriculum" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center px-2 text-center">
              <s.icon className="mb-2 h-6 w-6 text-accent" />
              <div className="font-serif text-3xl text-primary" data-testid={`stat-${s.label}`}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DEGREE LEVELS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-4xl text-primary">Find Your Calling</h2>
          <p className="mt-3 text-muted-foreground">Choose from four levels of accredited-style, faith-based study.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS.map((l) => (
            <Link key={l.name} href={`/programs?level=${encodeURIComponent(l.name)}`}>
              <Card className="group h-full cursor-pointer p-6 hover-elevate" data-testid={`card-level-${l.name}`}>
                <l.icon className="mb-4 h-8 w-8 text-primary" />
                <h3 className="font-serif text-2xl text-foreground">{l.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{l.blurb}</p>
                <p className="mt-4 text-sm font-semibold text-accent-foreground">
                  <span className="rounded-full bg-accent/20 px-2 py-0.5">{l.count} programs</span>
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PROGRAMS */}
      <section className="bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-4xl text-primary">Popular Programs</h2>
              <p className="mt-2 text-muted-foreground">A sampling of what you can study.</p>
            </div>
            <Link href="/programs"><Button variant="outline" data-testid="button-view-all">View all 38</Button></Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(programs ?? []).slice(0, 6).map((p) => (
              <Link key={p.id} href={`/programs/${p.slug}`}>
                <Card className="flex h-full flex-col p-6 hover-elevate cursor-pointer" data-testid={`card-featured-${p.id}`}>
                  <span className="mb-2 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{p.level}</span>
                  <h3 className="font-serif text-xl text-foreground">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-4 text-sm font-semibold text-foreground">${p.tuition.toLocaleString()} tuition</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <Quote className="mx-auto mb-6 h-10 w-10 text-accent" />
        <blockquote className="font-serif text-2xl leading-relaxed text-foreground sm:text-3xl">
          "Ambassadors met me right where I was — pastoring full-time while finishing my degree at my own pace.
          The teaching was sound, the Spirit was present, and my calling is clearer than ever."
        </blockquote>
        <p className="mt-6 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          — Placeholder Testimonial · M.Div. Graduate
        </p>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-serif text-4xl text-background">Answer the Call Today</h2>
          <p className="mx-auto mt-3 max-w-xl text-background/80">
            Enrollment is open year-round. Start your self-paced journey toward the degree God has placed on your heart.
          </p>
          <Link href="/apply">
            <Button size="lg" className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-cta-apply">
              Begin Your Application
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
