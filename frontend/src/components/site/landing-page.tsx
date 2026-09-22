import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { Stats } from "@/components/site/stats";
import { HowItWorks } from "@/components/site/how-it-works";
import { Problem } from "@/components/site/problem";
import { Features } from "@/components/site/features";
import { Freedom } from "@/components/site/freedom";
import { Gain } from "@/components/site/gain";
import { Orbit } from "@/components/site/orbit";
import { Shippers } from "@/components/site/shippers";
import { SocialProof } from "@/components/site/social-proof";
import { Pricing } from "@/components/site/pricing";
import { Faq } from "@/components/site/faq";
import { FinalCta } from "@/components/site/final-cta";
import { Footer } from "@/components/site/footer";

export function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Orbit />
        <Stats />
        <Problem />
        <HowItWorks />
        <Features />
        <Freedom />
        <Gain />
        <Shippers />
        <SocialProof />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
