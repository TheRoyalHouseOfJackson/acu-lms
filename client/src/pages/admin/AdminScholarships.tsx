import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Award, Plus, Trash2, Pencil, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Student = { id: number; name: string; email: string };
type Program = { id: number; title: string; slug: string; tuition: number; degree?: string };

interface Scholarship {
  id: number;
  userId: number;
  programId: number;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  waiveAppFee: number;
  note: string;
  active: number;
  createdAt: number;
  userName?: string;
  userEmail?: string;
  programTitle?: string;
  programTuition?: number;
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface EditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Scholarship | null;
  students: Student[];
  programs: Program[];
}

function ScholarshipEditor({ open, onOpenChange, editing, students, programs }: EditorProps) {
  const { toast } = useToast();
  const isNew = !editing;

  const [userId, setUserId] = useState<string>(editing ? String(editing.userId) : "");
  const [programId, setProgramId] = useState<string>(editing ? String(editing.programId) : "");
  const [name, setName] = useState(editing?.name ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(editing?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState<string>(
    editing
      ? editing.discountType === "percent"
        ? String(editing.discountValue)
        : (editing.discountValue / 100).toFixed(2)
      : ""
  );
  const [waiveAppFee, setWaiveAppFee] = useState<boolean>(editing ? editing.waiveAppFee === 1 : true);
  const [note, setNote] = useState(editing?.note ?? "");
  const [active, setActive] = useState<boolean>(editing ? editing.active === 1 : true);
  const [saving, setSaving] = useState(false);

  const selectedProgram = programs.find((p) => String(p.id) === programId);

  // Live preview
  const preview = useMemo(() => {
    if (!selectedProgram) return null;
    const tuitionCents = selectedProgram.tuition * 100;
    let discountCents = 0;
    const val = Number(discountValue) || 0;
    if (discountType === "percent") {
      const pct = Math.max(0, Math.min(100, val));
      discountCents = Math.round(tuitionCents * pct / 100);
    } else {
      const cents = Math.max(0, Math.round(val * 100));
      discountCents = Math.min(tuitionCents, cents);
    }
    return {
      tuitionCents,
      discountCents,
      finalTuition: Math.max(0, tuitionCents - discountCents),
    };
  }, [selectedProgram, discountType, discountValue]);

  const handleSave = async () => {
    if (!userId || !programId) {
      toast({ title: "Missing fields", description: "Select a student and a program.", variant: "destructive" });
      return;
    }
    const val = Number(discountValue);
    if (isNaN(val) || val < 0) {
      toast({ title: "Invalid amount", description: "Discount must be a non-negative number.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        userId: Number(userId),
        programId: Number(programId),
        name: name.trim() || (discountType === "percent" && val === 100 ? "Full Scholarship" : "Scholarship"),
        discountType,
        discountValue: discountType === "percent" ? val : Math.round(val * 100),
        waiveAppFee,
        note,
        active,
      };
      if (isNew) {
        await apiRequest("POST", "/api/admin/scholarships", payload);
        toast({ title: "Scholarship created", description: `${payload.name} applied.` });
      } else {
        const patch = {
          name: payload.name,
          discountType,
          discountValue: payload.discountValue,
          waiveAppFee,
          note,
          active,
        };
        await apiRequest("PATCH", `/api/admin/scholarships/${editing!.id}`, patch);
        toast({ title: "Scholarship updated" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scholarships"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Award Scholarship" : "Edit Scholarship"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Student</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!isNew}>
                <SelectTrigger data-testid="select-student"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} · {s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Program</Label>
              <Select value={programId} onValueChange={setProgramId} disabled={!isNew}>
                <SelectTrigger data-testid="select-program"><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title} · ${p.tuition.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Scholarship name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founder's Full Scholarship" data-testid="input-name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                <SelectTrigger data-testid="select-discount-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{discountType === "percent" ? "Percent (0-100)" : "Amount in USD"}</Label>
              <Input
                type="number"
                min="0"
                max={discountType === "percent" ? "100" : undefined}
                step={discountType === "percent" ? "1" : "0.01"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "100" : "1000.00"}
                data-testid="input-discount-value"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Waive application fee</p>
              <p className="text-xs text-muted-foreground">Skip the $55–$95 application fee at checkout.</p>
            </div>
            <Switch checked={waiveAppFee} onCheckedChange={setWaiveAppFee} data-testid="switch-waive-fee" />
          </div>

          <div>
            <Label>Note (internal)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approved by Board on..." rows={2} data-testid="input-note" />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">If off, the discount won't apply at checkout.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} data-testid="switch-active" />
          </div>

          {preview && (
            <Card className="border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Preview</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span>Tuition:</span><span className="tabular-nums">{fmt(preview.tuitionCents)}</span></div>
                <div className="flex justify-between text-primary"><span>Discount:</span><span className="tabular-nums">− {fmt(preview.discountCents)}</span></div>
                <div className="flex justify-between border-t border-primary/20 pt-1 font-semibold"><span>Student pays (tuition):</span><span className="tabular-nums">{fmt(preview.finalTuition)}</span></div>
                {waiveAppFee && <p className="text-primary">+ Application fee waived</p>}
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save">{saving ? "Saving..." : isNew ? "Award scholarship" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminScholarships() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Scholarship | null>(null);

  const { data: scholarships, isLoading } = useQuery<Scholarship[]>({ queryKey: ["/api/admin/scholarships"] });
  const { data: students } = useQuery<Student[]>({ queryKey: ["/api/admin/students"] });
  const { data: programs } = useQuery<Program[]>({ queryKey: ["/api/programs"] });

  const filtered = useMemo(() => {
    if (!scholarships) return [];
    if (!search.trim()) return scholarships;
    const q = search.toLowerCase();
    return scholarships.filter((s) =>
      (s.userName ?? "").toLowerCase().includes(q) ||
      (s.userEmail ?? "").toLowerCase().includes(q) ||
      (s.programTitle ?? "").toLowerCase().includes(q) ||
      (s.name ?? "").toLowerCase().includes(q)
    );
  }, [scholarships, search]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this scholarship? The student will pay full tuition on next checkout.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/scholarships/${id}`);
      toast({ title: "Scholarship deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scholarships"] });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (s: Scholarship) => {
    try {
      await apiRequest("PATCH", `/api/admin/scholarships/${s.id}`, { active: s.active !== 1 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scholarships"] });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: Scholarship) => { setEditing(s); setDialogOpen(true); };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary">Scholarships</h1>
          <p className="mt-1 text-muted-foreground">Award full or partial tuition discounts to enrolled or prospective students.</p>
        </div>
        <Button onClick={openNew} data-testid="button-new-scholarship">
          <Plus className="mr-2 h-4 w-4" /> Award scholarship
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student, email, program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} scholarship{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Award className="mx-auto mb-2 h-8 w-8" />
            <p>{search ? "No scholarships match your search." : "No scholarships awarded yet."}</p>
            {!search && (
              <Button className="mt-4" onClick={openNew} data-testid="button-empty-new">
                <Plus className="mr-2 h-4 w-4" /> Award your first scholarship
              </Button>
            )}
          </Card>
        ) : (
          filtered.map((s) => {
            const tuitionCents = (s.programTuition ?? 0) * 100;
            const discountCents = s.discountType === "percent"
              ? Math.round(tuitionCents * s.discountValue / 100)
              : Math.min(tuitionCents, s.discountValue);
            const isFull = tuitionCents > 0 && discountCents === tuitionCents && s.waiveAppFee === 1;
            return (
              <Card key={s.id} className="p-5" data-testid={`scholarship-${s.id}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-serif text-lg text-foreground">{s.name || "Scholarship"}</p>
                      {isFull && <Badge className="bg-primary text-primary-foreground">Full ride</Badge>}
                      {s.active !== 1 && <Badge variant="secondary">Inactive</Badge>}
                      {s.waiveAppFee === 1 && !isFull && <Badge variant="outline">App fee waived</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      <span className="font-medium">{s.userName}</span>
                      <span className="text-muted-foreground"> · {s.userEmail}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{s.programTitle}</p>
                    {s.note && <p className="mt-2 text-xs italic text-muted-foreground">"{s.note}"</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-4 sm:gap-6 text-sm sm:text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Tuition</p>
                      <p className="tabular-nums text-foreground">{fmt(tuitionCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="tabular-nums font-semibold text-primary">
                        {s.discountType === "percent" ? `${s.discountValue}%` : fmt(s.discountValue)}
                      </p>
                      <p className="text-xs text-muted-foreground">− {fmt(discountCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Student pays</p>
                      <p className="tabular-nums font-semibold text-foreground">{fmt(tuitionCents - discountCents)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="ghost" onClick={() => handleToggleActive(s)} data-testid={`button-toggle-${s.id}`}>
                    {s.active === 1 ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-${s.id}`}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)} data-testid={`button-delete-${s.id}`}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ScholarshipEditor
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        students={students ?? []}
        programs={programs ?? []}
      />
    </AdminLayout>
  );
}
