import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Program } from "@/lib/types";
import { LEVELS } from "@/lib/types";
import { Search } from "lucide-react";

export default function Programs() {
  const search = useSearch();
  const [level, setLevel] = useState<string>("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const l = params.get("level");
    if (l && (LEVELS as readonly string[]).includes(l)) setLevel(l);
  }, [search]);

  const { data: programs, isLoading } = useQuery<Program[]>({ queryKey: ["/api/programs"] });

  const filtered = (programs ?? []).filter((p) => {
    const matchLevel = level === "All" || p.level === level;
    const matchQ = q === "" || p.title.toLowerCase().includes(q.toLowerCase());
    return matchLevel && matchQ;
  });

  return (
    <SiteLayout>
      <section className="border-b border-border bg-gradient-to-br from-primary to-[hsl(347_40%_24%)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="font-serif text-5xl text-background">Degree Programs</h1>
          <p className="mt-3 max-w-2xl text-background/80">
            Explore all 38 self-paced, faith-based programs. Filter by level to find your calling.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Filters */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {["All", ...LEVELS].map((l) => (
              <Button
                key={l}
                variant={level === l ? "default" : "outline"}
                size="sm"
                onClick={() => setLevel(l)}
                data-testid={`filter-${l}`}
              >
                {l}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search programs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              data-testid="input-search-programs"
            />
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground" data-testid="text-result-count">
          {filtered.length} program{filtered.length !== 1 ? "s" : ""}
        </p>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link key={p.id} href={`/programs/${p.slug}`}>
                <Card className="flex h-full cursor-pointer flex-col p-6 hover-elevate" data-testid={`card-program-${p.id}`}>
                  <span className="mb-2 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{p.level}</span>
                  <h3 className="font-serif text-xl leading-tight text-foreground">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm font-semibold text-foreground">${p.tuition.toLocaleString()}</span>
                    <span className="text-sm font-medium text-primary">View details →</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
