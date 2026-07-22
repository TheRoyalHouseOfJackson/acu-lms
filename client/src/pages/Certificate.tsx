import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "@/components/Logo";
import { Printer } from "lucide-react";

type Cert = { publicId: string; issuedAt: number; studentName: string; programTitle: string; programLevel: string };

export default function Certificate() {
  const [, params] = useRoute("/certificates/:publicId");
  const publicId = params?.publicId;
  const { data: cert, isLoading, isError } = useQuery<Cert>({ queryKey: ["/api/certificates", publicId], enabled: !!publicId });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-24"><Skeleton className="h-96 w-full" /></div>;
  if (isError || !cert) return <div className="mx-auto max-w-lg px-4 py-24 text-center"><h1 className="font-serif text-3xl text-primary">Certificate Not Found</h1><p className="mt-2 text-muted-foreground">This certificate does not exist.</p></div>;

  const date = new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex justify-center print:hidden">
          <Button onClick={() => window.print()} data-testid="button-print"><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
        </div>

        {/* Certificate */}
        <div className="relative overflow-hidden rounded-lg border-[6px] border-double border-primary bg-card p-10 text-center shadow-xl sm:p-16 print:border-primary print:shadow-none" data-testid="certificate">
          {/* gold inner frame */}
          <div className="pointer-events-none absolute inset-4 rounded border border-accent/50" />
          <div className="relative">
            <div className="mb-6 flex justify-center"><LogoMark size={96} /></div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Ambassadors Christian University</p>
            <h1 className="mt-6 font-serif text-4xl text-primary sm:text-5xl">Certificate of Completion</h1>
            <p className="mt-8 text-sm uppercase tracking-widest text-muted-foreground">This certifies that</p>
            <p className="mt-2 font-serif text-3xl text-foreground sm:text-4xl" data-testid="cert-student">{cert.studentName}</p>
            <p className="mx-auto mt-6 max-w-lg text-muted-foreground">has successfully completed all requirements for the</p>
            <p className="mt-2 font-serif text-2xl text-primary sm:text-3xl" data-testid="cert-program">{cert.programTitle}</p>
            <p className="mt-1 text-sm uppercase tracking-wider text-accent-foreground">{cert.programLevel} Program</p>

            <div className="mt-12 flex items-end justify-between gap-8">
              <div className="flex-1 text-center">
                <p className="border-t border-foreground/40 pt-2 font-serif text-lg text-foreground">Dr. Founder</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">President</p>
              </div>
              <div className="flex-1 text-center">
                <p className="border-t border-foreground/40 pt-2 font-serif text-lg text-foreground">{date}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Date Issued</p>
              </div>
            </div>
            <p className="mt-8 text-[0.65rem] text-muted-foreground">Verification ID: {cert.publicId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
