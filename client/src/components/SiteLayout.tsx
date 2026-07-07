import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Menu, X, LogOut, LayoutDashboard, Shield } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/about", label: "About" },
  { href: "/apply", label: "Apply" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const initials = user?.name?.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() ?? "";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/"><a data-testid="link-home"><Logo /></a></Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              <a
                data-testid={`nav-${n.label.toLowerCase()}`}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover-elevate"
              >
                {n.label}
              </a>
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" data-testid="button-user-menu">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name.split(" ")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/dashboard")} data-testid="menu-dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin">
                    <Shield className="mr-2 h-4 w-4" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" data-testid="button-login">Log in</Button></Link>
              <Link href="/apply"><Button data-testid="button-apply-nav">Apply Now</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} data-testid="button-mobile-menu" aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              <a className="block rounded-md px-3 py-2 text-sm font-medium hover-elevate" onClick={() => setOpen(false)} data-testid={`nav-mobile-${n.label.toLowerCase()}`}>
                {n.label}
              </a>
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            {user ? (
              <>
                <Link href="/dashboard"><Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Dashboard</Button></Link>
                {user.role === "admin" && <Link href="/admin"><Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Admin</Button></Link>}
                <Button variant="ghost" className="w-full" onClick={async () => { await logout(); setOpen(false); }}>Log out</Button>
              </>
            ) : (
              <>
                <Link href="/login"><Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Log in</Button></Link>
                <Link href="/apply"><Button className="w-full" onClick={() => setOpen(false)}>Apply Now</Button></Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-sidebar-foreground/70">
            A private online Christian university preparing servants for the Kingdom through
            self-paced, faith-based degree programs.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Explore</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            <li><Link href="/programs"><a className="hover:text-accent">All Programs</a></Link></li>
            <li><Link href="/about"><a className="hover:text-accent">About Us</a></Link></li>
            <li><Link href="/apply"><a className="hover:text-accent">Apply / Enroll</a></Link></li>
            <li><Link href="/login"><a className="hover:text-accent">Student Login</a></Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Contact</h4>
          <p className="text-sm text-sidebar-foreground/80">
            Mobile, Alabama<br />
            info@acu.edu<br />
            (251) 555-0100
          </p>
        </div>
      </div>
      <div className="border-t border-sidebar-border py-4 text-center text-xs text-sidebar-foreground/60">
        © {new Date().getFullYear()} Ambassadors Christian University. All rights reserved.
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
