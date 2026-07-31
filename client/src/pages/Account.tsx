import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ToggleFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  testId: string;
  toggleTestId: string;
  autoComplete: string;
  helper?: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  testId,
  toggleTestId,
  autoComplete,
  helper,
}: ToggleFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          data-testid={testId}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          tabIndex={-1}
          data-testid={toggleTestId}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export default function Account() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePassword = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Use your new password next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    },
    onError: async (err: any) => {
      let message = "Could not update password.";
      try {
        const raw = err?.message || "";
        const match = raw.match(/\{.*\}$/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed?.message) message = parsed.message;
        }
      } catch {
        // fall through to default
      }
      toast({ title: "Change failed", description: message, variant: "destructive" });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters. Longer is better.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "The new password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }
    if (currentPassword === newPassword) {
      toast({
        title: "Pick a new password",
        description: "New password must differ from the current one.",
        variant: "destructive",
      });
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  if (authLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center text-muted-foreground">Loading...</div>
      </SiteLayout>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-serif text-4xl text-primary" data-testid="text-account-title">
          Account Settings
        </h1>
        <p className="mt-2 text-muted-foreground">Manage how you sign in to Ambassadors Christian University.</p>

        <Card className="mt-8 p-6">
          <h2 className="text-xl font-semibold" data-testid="text-account-profile-heading">
            Profile
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium" data-testid="text-account-name">
                {user.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium" data-testid="text-account-email">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize" data-testid="text-account-role">
                {user.role}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="mt-6 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Change Password</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password you don't use anywhere else. Minimum 8 characters — mix upper and lower case,
            numbers, and a symbol for best results.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <PasswordField
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              visible={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              autoComplete="current-password"
              testId="input-current-password"
              toggleTestId="button-toggle-current-password"
            />
            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNew}
              onToggle={() => setShowNew((v) => !v)}
              autoComplete="new-password"
              testId="input-new-password"
              toggleTestId="button-toggle-new-password"
              helper="At least 8 characters."
            />
            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
              testId="input-confirm-password"
              toggleTestId="button-toggle-confirm-password"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={
                  changePassword.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                data-testid="button-submit-change-password"
              >
                {changePassword.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </SiteLayout>
  );
}
