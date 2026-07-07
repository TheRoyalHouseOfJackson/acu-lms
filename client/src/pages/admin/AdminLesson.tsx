import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Check } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

type LessonFull = {
  id: number; courseId: number; title: string; type: string;
  contentUrl: string; contentText: string; durationMinutes: number;
  course: { id: number; title: string; programId: number };
};

export default function AdminLesson() {
  const [, params] = useRoute("/admin/lessons/:id");
  const lessonId = Number(params?.id);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: lesson, isLoading } = useQuery<LessonFull>({ queryKey: ["/api/lessons", lessonId], enabled: !!lessonId });

  const [form, setForm] = useState({ title: "", type: "text", contentUrl: "", contentText: "", durationMinutes: 0 });
  useEffect(() => {
    if (lesson) setForm({ title: lesson.title, type: lesson.type, contentUrl: lesson.contentUrl, contentText: lesson.contentText, durationMinutes: lesson.durationMinutes });
  }, [lesson?.id]);

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/lessons/${lessonId}`, form)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", lesson?.courseId] });
      toast({ title: "Saved", description: "Lesson updated." });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setForm((f) => ({ ...f, contentUrl: data.url }));
      toast({ title: "File uploaded", description: "Remember to Save the lesson." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message ?? "Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !lesson) return <AdminLayout><Skeleton className="h-96 w-full" /></AdminLayout>;

  return (
    <AdminLayout>
      <Link href={`/admin/courses/${lesson.courseId}`}><a className="text-sm text-muted-foreground hover:text-primary">← {lesson.course?.title}</a></Link>
      <h1 className="mt-2 font-serif text-3xl text-primary">Edit Lesson</h1>

      <Card className="mt-6 space-y-5 p-6">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-lesson-title" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Lesson Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text / Markdown</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} data-testid="input-duration" />
          </div>
        </div>

        {/* VIDEO */}
        {form.type === "video" && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <div>
              <Label>Video URL (YouTube, Vimeo, or direct MP4)</Label>
              <Input placeholder="https://youtube.com/watch?v=... or /uploads/video.mp4" value={form.contentUrl} onChange={(e) => setForm({ ...form, contentUrl: e.target.value })} data-testid="input-video-url" />
              <p className="mt-1 text-xs text-muted-foreground">Recommended: paste a YouTube/Vimeo link for large videos.</p>
            </div>
            <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">— or upload an MP4 —</div>
            <div>
              <input ref={fileRef} type="file" accept="video/mp4,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} data-testid="input-video-file" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-video">
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload MP4 (up to 500MB)"}
              </Button>
              {form.contentUrl.startsWith("/uploads/") && <span className="ml-2 text-xs text-primary"><Check className="mr-1 inline h-3 w-3" />{form.contentUrl}</span>}
            </div>
          </div>
        )}

        {/* PDF */}
        {form.type === "pdf" && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} data-testid="input-pdf-file" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-upload-pdf">
              <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload PDF"}
            </Button>
            {form.contentUrl && <p className="text-xs text-primary"><Check className="mr-1 inline h-3 w-3" />{form.contentUrl}</p>}
            <div>
              <Label className="text-xs">Or paste a PDF URL</Label>
              <Input value={form.contentUrl} onChange={(e) => setForm({ ...form, contentUrl: e.target.value })} data-testid="input-pdf-url" />
            </div>
          </div>
        )}

        {/* TEXT */}
        {form.type === "text" && (
          <div>
            <Label>Content (Markdown supported)</Label>
            <Textarea rows={12} className="font-mono text-sm" value={form.contentText} onChange={(e) => setForm({ ...form, contentText: e.target.value })} data-testid="input-content-text" />
            <p className="mt-1 text-xs text-muted-foreground"># Heading, **bold**, *italic*, - lists, {'>'} quotes, [links](url) are supported.</p>
          </div>
        )}

        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-lesson">
          {save.isPending ? "Saving…" : "Save Lesson"}
        </Button>
      </Card>
    </AdminLayout>
  );
}
