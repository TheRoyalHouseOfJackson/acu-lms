import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { DiamondHero } from "@/components/DiamondHero";
import type { Program } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

export default function Apply() {
  const { user, signup } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: programs } = useQuery<Program[]>({ queryKey: ["/api/programs"] });

  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", programId: "", statement: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!user) {
        if (form.password.length < 6) { toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" }); setLoading(false); return; }
        await signup(form.name, form.email, form.password);
      }
      setSubmitted(true);
      toast({ title: "Application received!", description: "Your account is ready. Head to your dashboard to enroll." });
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
          <h1 className="font-serif text-4xl text-primary">Application Received</h1>
          <p className="mt-3 text-muted-foreground">
            Welcome to Ambassadors Christian University. Your student account is ready — visit your dashboard to
            enroll in your program and begin learning.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={() => navigate("/dashboard")} data-testid="button-goto-dashboard">Go to Dashboard</Button>
            <Link href="/programs"><Button variant="outline">Browse Programs</Button></Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <DiamondHero size="md">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-5xl text-background">Apply / Enroll</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-background/80">
            {user ? "Complete your program application below." : "Create your student account and tell us about your calling."}
          </p>
        </div>
      </DiamondHero>

      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">

        <Card className="mt-8 p-6">
          <form onSubmit={submit} className="space-y-5">
            {!user && (
              <>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="input-name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="input-email" />
                </div>
                <div>
                  <Label htmlFor="password">Create a Password</Label>
                  <Input id="password" type="password" required value={form.password} onChange={(e) => set("password", e.target.value)} data-testid="input-password" />
                  <p className="mt-1 text-xs text-muted-foreground">At least 6 characters.</p>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="input-phone" />
            </div>
            <div>
              <Label>Program of Interest</Label>
              <Select value={form.programId} onValueChange={(v) => set("programId", v)}>
                <SelectTrigger data-testid="select-program"><SelectValue placeholder="Select a program" /></SelectTrigger>
                <SelectContent>
                  {(programs ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="statement">Statement of Calling (optional)</Label>
              <Textarea id="statement" rows={4} value={form.statement} onChange={(e) => set("statement", e.target.value)} placeholder="Tell us why you feel called to this program..." data-testid="input-statement" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-application">
              {loading ? "Submitting..." : user ? "Submit Application" : "Create Account & Apply"}
            </Button>
            {!user && (
              <p className="text-center text-sm text-muted-foreground">
                Already have an account? <Link href="/login"><a className="font-medium text-primary hover:underline">Log in</a></Link>
              </p>
            )}
          </form>
        </Card>
      </div>
    </SiteLayout>
  );
}
