import { useState } from "react";
import { useLocation, Link } from "wouter";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast({ title: "Welcome back", description: `Signed in as ${u.name}` });
      navigate(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="mb-6 flex justify-center"><LogoMark size={56} /></div>
        <h1 className="text-center font-serif text-4xl text-primary">Welcome Back</h1>
        <p className="mt-2 text-center text-muted-foreground">Sign in to continue your studies.</p>
        <Card className="mt-8 p-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-login-email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-login-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-login">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            New here? <Link href="/signup"><a className="font-medium text-primary hover:underline" data-testid="link-signup">Create an account</a></Link>
          </p>
        </Card>
      </div>
    </SiteLayout>
  );
}
