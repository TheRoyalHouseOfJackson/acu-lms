import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Program } from "@/lib/types";
import { LEVELS } from "@/lib/types";
import { Search, ChevronRight } from "lucide-react";

export default function AdminPrograms() {
  const { data: programs, isLoading } = useQuery<Program[]>({ queryKey: ["/api/programs"] });
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("All");

  const filtered = (programs ?? []).filter((p) =>
    (level === "All" || p.level === level) &&
    (q === "" || p.title.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AdminLayout>
      <h1 className="font-serif text-3xl text-primary">Programs</h1>
      <p className="mt-1 text-muted-foreground">{programs?.length ?? 0} programs. Click a program to manage its courses and lessons.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["All", ...LEVELS].map((l) => (
            <Button key={l} size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)} data-testid={`admin-filter-${l}`}>{l}</Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="admin-search-programs" />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />) :
          filtered.map((p) => (
            <Link key={p.id} href={`/admin/programs/${p.id}`}>
              <Card className="flex cursor-pointer items-center justify-between p-4 hover-elevate" data-testid={`admin-program-${p.id}`}>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{p.level}</span>
                  <span className="font-medium text-foreground">{p.title}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden text-sm text-muted-foreground sm:inline">${p.tuition.toLocaleString()}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
      </div>
    </AdminLayout>
  );
}
