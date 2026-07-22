import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Heart, BookOpen, Users, Globe } from "lucide-react";
import { DiamondHero } from "@/components/DiamondHero";

export default function About() {
  return (
    <SiteLayout>
      <DiamondHero size="md">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-serif text-5xl text-background">Our Mission</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-background/80">
            To equip and empower faithful servants — pastors, counselors, chaplains, and leaders —
            for a lifetime of Kingdom service.
          </p>
        </div>
      </DiamondHero>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="prose-lg space-y-6 text-foreground/90">
          <p className="text-lg leading-relaxed">
            Ambassadors Christian University was founded on a simple conviction: that God calls ordinary people
            to extraordinary service, and that the local church is the training ground for the next generation of
            spiritual leaders. We exist to make sound, Spirit-filled theological education accessible to every
            believer — regardless of geography, season of life, or budget.
          </p>
          <p className="leading-relaxed">
            Rooted in the rich tradition of the African American church and the fire of Pentecostal faith, our
            curriculum weds academic rigor with pastoral warmth. We believe that the mind and the Spirit are not
            enemies but partners, and that the deepest learning happens when Scripture is studied on our knees.
          </p>
          <blockquote className="border-l-4 border-accent pl-6 font-serif text-2xl italic text-primary">
            "Now then we are ambassadors for Christ, as though God did beseech you by us." — 2 Corinthians 5:20
          </blockquote>
          <p className="leading-relaxed">
            Every one of our 38 self-paced programs is designed for the servant who is already serving — the
            bivocational pastor, the ministry leader, the working parent with a call on their life. You study
            when you can, where you are, and you graduate ready to lead.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {[
            { icon: BookOpen, title: "Scripture First", body: "Every course begins and ends with the Word of God." },
            { icon: Heart, title: "Pastoral Care", body: "We shepherd students, not just enroll them." },
            { icon: Globe, title: "Accessible", body: "Fully online and self-paced — study from anywhere." },
            { icon: Users, title: "Kingdom-Minded", body: "We train servants to build up the whole Body of Christ." },
          ].map((v) => (
            <Card key={v.title} className="p-6">
              <v.icon className="mb-3 h-7 w-7 text-accent" />
              <h3 className="font-serif text-xl text-foreground">{v.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.body}</p>
            </Card>
          ))}
        </div>

        <div className="mt-14 rounded-xl bg-card p-8 text-center">
          <p className="font-serif text-3xl text-primary">Dr. Founder</p>
          <p className="mt-1 text-sm uppercase tracking-wider text-muted-foreground">President & Founder</p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-foreground/80">
            Pastor of The City Church of Baton Rouge and lifelong servant of the Gospel, Dr. Founder established
            Ambassadors Christian University to raise up a generation of equipped, credentialed, Spirit-led leaders.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
