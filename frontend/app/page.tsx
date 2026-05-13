import Image from "next/image";
import {
  ClipboardCheck,
  Bell,
  BarChart3,
} from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Navbar } from "@/components/navbar";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { CTAButton } from "@/components/cta-button";
import { UserSync } from "@/components/user-sync";
import { RoleRedirect } from "@/components/role-redirect";

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="flex flex-col items-center px-6 pt-20 pb-16 text-center">
      <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Civic engagement,
        <br />
        Prioritise what matters.
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
        Spot a broken streetlight? A faded notice? Pick up a quick civic task,
        verify it in minutes, and make a real difference — no long commitments
        required.
      </p>

      {/* Sign in with Google — triggers Clerk OAuth */}
      <GoogleSignInButton className="mt-8" />
    </section>
  );
}

/* ─── Hero Illustration Placeholder ─── */
function HeroImage() {
  return (
    <section className="flex justify-center px-6 pb-8">
      <div className="relative h-72 w-full max-w-4xl overflow-hidden sm:h-96">
        <Image
          src="/imgs/civic.jpeg"
          alt="Civic micro-tasks"
          fill
          className="object-contain"
          priority
        />
      </div>
    </section>
  );
}



/* ─── Feature Row (alternating layout) ─── */
function FeatureRow({
  heading,
  description,
  icon: Icon,
  imageSrc,
  imageAlt,
  reversed = false,
}: {
  heading: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  imageSrc?: string;
  imageAlt?: string;
  reversed?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-10 md:flex-row ${
        reversed ? "md:flex-row-reverse" : ""
      }`}
    >
      {/* Text */}
      <div className="flex-1 space-y-3">
        <h3 className="text-2xl font-bold tracking-tight">{heading}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Image / Placeholder */}
      {imageSrc ? (
        <div className="w-full flex-1">
          <Image
            src={imageSrc}
            alt={imageAlt ?? heading}
            width={1200}
            height={800}
            className="h-auto w-full max-h-80 rounded-2xl object-contain"
          />
        </div>
      ) : (
        <div className="flex h-64 w-full flex-1 items-center justify-center rounded-2xl bg-muted md:h-72">
          <Icon className="h-14 w-14 text-muted-foreground/60 stroke-[1.2]" />
        </div>
      )}
    </div>
  );
}

/* ─── Features Section ─── */
function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl space-y-24 px-6 pt-8 pb-24">
      <FeatureRow
        heading="Quick micro-tasks."
        description="View and pick up civic tasks near you — report broken streetlights, verify public notices, or check local facilities. Each task takes just a few focused minutes."
        icon={ClipboardCheck}
        imageSrc="/imgs/quick%20micro%20task.png"
        imageAlt="Quick micro-tasks"
      />
      <FeatureRow
        heading="One For Everything"
        description="Stay organized and in control — discover tasks, track your progress, receive real-time updates, manage submissions, and participate in community initiatives all from a single, seamless platform."
        icon={Bell}
        imageSrc="/imgs/1fe.jpeg"
        imageAlt="One for everything"
        reversed
      />
      <FeatureRow
        heading="Community insights."
        description="Track your contributions with clear visual reports. See how your micro-actions add up to measurable improvements in your neighbourhood."
        icon={BarChart3}
        imageSrc="/imgs/analy.jpeg"
        imageAlt="Community insights"
      />
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Sign in",
      desc: "Register using your unique house number and log in to your community account — secure and simple.",
    },
    {
      step: "02",
      title: "Report an Issue",
      desc: "Upload a photo, add the location and description, and select the category. Suggest the relevant department if needed.",
    },
    {
      step: "03",
      title: "AI Analysis & Community Support",
      desc: "Our AI analyzes the issue and assigns a severity score. Residents can upvote and discuss the issue to help prioritize it.",
    },
    {
      step: "04",
      title: "Admin Action & Resolution",
      desc: "The admin reviews the issue, assigns the department, updates the status, and ensures it is resolved. Progress is transparent and visible to everyone.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="border-t border-border/40 bg-muted/40 py-24"
    >
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Get started in under a minute — contribute to your community in just a
          few taps.
        </p>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-14">
          {steps.map((s) => (
            <div key={s.step} className="space-y-3">
              <span className="text-3xl font-extrabold text-muted-foreground/40">
                {s.step}
              </span>
              <h4 className="text-lg font-semibold">{s.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ─── */
function CTA() {
  return (
    <section className="py-24 text-center">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to make a difference?
        </h2>
        <p className="mt-4 text-muted-foreground">
          Small efforts. Measurable improvements. Join the civic micro-task
          movement today.
        </p>
        <CTAButton className="mt-8" />
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer id="contact" className="border-t border-border/40 py-12">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-4">
        <div>
          <span className="text-lg font-bold">Civix.</span>
          <p className="mt-2 text-sm text-muted-foreground">
            Bridging residents and local bodies through verified micro-actions.
          </p>
        </div>

        <div>
          <h5 className="mb-3 text-sm font-semibold">Company</h5>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground transition">About</a></li>
            <li><a href="#" className="hover:text-foreground transition">Careers</a></li>
            <li><a href="#" className="hover:text-foreground transition">Press</a></li>
          </ul>
        </div>

        <div>
          <h5 className="mb-3 text-sm font-semibold">Product</h5>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground transition">Features</a></li>
            <li><a href="#how-it-works" className="hover:text-foreground transition">How It Works</a></li>
            <li><a href="#" className="hover:text-foreground transition">Pricing</a></li>
          </ul>
        </div>

        <div>
          <h5 className="mb-3 text-sm font-semibold">Support</h5>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground transition">Help Center</a></li>
            <li><a href="#" className="hover:text-foreground transition">Contact</a></li>
            <li><a href="#" className="hover:text-foreground transition">Legal</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl border-t border-border/40 px-6 pt-6">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Civix. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen">
      <UserSync />

      {/* Signed-in users are redirected to their dashboard immediately */}
      <SignedIn>
        <RoleRedirect />
      </SignedIn>

      {/* Only show the landing page to visitors who are NOT signed in */}
      <SignedOut>
        <Navbar />
        <main>
          <Hero />
          <HeroImage />
          <Features />
          <HowItWorks />
          <CTA />
        </main>
        <Footer />
      </SignedOut>
    </div>
  );
}
