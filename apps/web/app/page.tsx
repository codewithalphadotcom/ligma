import { env } from '@/lib/env';
import Nav from '@/components/landing/Nav';
import Hero from '@/components/landing/Hero';
import Showcase from '@/components/landing/Showcase';
import Process from '@/components/landing/Process';
import Manifesto from '@/components/landing/Manifesto';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const demoRoom = env.defaultRoom;

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0906] font-poppins">
      <Nav />
      <Hero demoRoom={demoRoom} />
      <Showcase />
      <Process />
      <Manifesto />
      <Footer />
    </main>
  );
}
