import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, BookOpen, Users, LogOut, ExternalLink, CreditCard, Receipt, Award } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/programs", label: "Programs", icon: BookOpen },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/scholarships", label: "Scholarships", icon: Award },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/paypal", label: "PayPal Setup", icon: CreditCard },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) navigate("/login");
  }, [isLoading, user, navigate]);

  if (!user || user.role !== "admin") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border p-4">
          <Link href="/admin"><a><Logo tone="light" size={57} /></a></Link>
          <p className="mt-2 text-xs uppercase tracking-wider text-accent">Admin Console</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
            const active = location === n.href || (n.href !== "/admin" && location.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href}>
                <a data-testid={`admin-nav-${n.label.toLowerCase()}`} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link href="/"><a className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50" data-testid="admin-view-site"><ExternalLink className="h-4 w-4" /> View Site</a></Link>
          <button onClick={async () => { await logout(); navigate("/"); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50" data-testid="admin-logout">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <div className="flex-1">
        {/* mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <Logo size={42} tone="light" />
          <div className="flex gap-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}><Button size="sm" variant="ghost" className="text-sidebar-foreground">{n.label}</Button></Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
