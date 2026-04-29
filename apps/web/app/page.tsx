import { env } from '@/lib/env';
import Nav from '@/components/landing/Nav';
import Hero from '@/components/landing/Hero';
import Showcase from '@/components/landing/Showcase';
import Sequence from '@/components/landing/Sequence';
import Pillars from '@/components/landing/Pillars';
import Manifesto from '@/components/landing/Manifesto';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const demoRoom = env.defaultRoom;

  return (
    <main className="relative flex min-h-screen flex-col bg-[#0b0906] font-poppins">
      {/* Warm brass grid — full page, starts from top edge behind the fixed nav */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(190,148,96,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.09) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Soft warm radial vignette at top center */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 0%, rgba(190,148,96,0.08) 0%, transparent 65%)',
        }}
      />
      <Nav />
      <Hero demoRoom={demoRoom} />
      <Showcase />
      <Sequence />
      <Pillars />
      <Manifesto />
      <CTA />
      <Footer />
    </main>
  );
}
