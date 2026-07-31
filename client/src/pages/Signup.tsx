import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const u = await signup(name, email, password);
      toast({ title: "Account created", description: `Welcome, ${u.name}!` });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Sign up failed", description: err.message?.includes("409") ? "That email is already registered." : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="mb-6 flex justify-center"><LogoMark size={84} /></div>
        <h1 className="text-center font-serif text-4xl text-primary">Create Your Account</h1>
        <p className="mt-2 text-center text-muted-foreground">Join Ambassadors and begin your calling.</p>
        <Card className="mt-8 p-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-signup-name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-signup-email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  data-testid="input-signup-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  data-testid="button-toggle-signup-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">At least 6 characters.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-signup">
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login"><a className="font-medium text-primary hover:underline" data-testid="link-login">Log in</a></Link>
          </p>
        </Card>
      </div>
    </SiteLayout>
  );
}
