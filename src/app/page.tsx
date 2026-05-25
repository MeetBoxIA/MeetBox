import FloatingNav from '@/components/ui/floating-nav';
import HeroSection from '@/components/ui/hero-section';
import ProblemSection from '@/components/landing/problem-section';
import ProductsSection from '@/components/landing/products-section';
import HowItWorks from '@/components/landing/how-it-works';
import VideoSection from '@/components/landing/video-section';
import IntegrationsSection from '@/components/landing/integrations-section';
import MeetySection from '@/components/landing/meety-section';
import PricingSection from '@/components/landing/pricing-section';
import CtaSection from '@/components/landing/cta-section';

export default function Page() {
  return (
    <main>
      <FloatingNav />
      <HeroSection />
      <ProblemSection />
      <ProductsSection />
      <HowItWorks />
      <VideoSection />
      <IntegrationsSection />
      <MeetySection />
      <PricingSection />
      <CtaSection />
    </main>
  );
}
