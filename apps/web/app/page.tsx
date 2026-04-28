import Link from 'next/link';
import { env } from '@/lib/env';

const features = [
  {
    icon: '🎨',
    title: 'Infinite Canvas',
    description: 'Pan, zoom, draw, and place sticky notes, shapes, and freehand strokes on a shared infinite board.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Sync',
    description: 'Powered by Y.js CRDT — edits merge conflict-free across all users with no page refresh needed.',
  },
  {
    icon: '✅',
    title: 'Live Task Board',
    description: 'AI classifies canvas text automatically. Action items surface instantly in the shared Task Board.',
  },
  {
    icon: '🔒',
    title: 'Node-Level RBAC',
    description: 'Leads lock individual nodes. Contributors edit, Viewers comment. Enforced server-side on every mutation.',
  },
];

const steps = [
  { n: '1', title: 'Create a room', desc: 'Sign up, name your room, and share the link with your team in one click.' },
  { n: '2', title: 'Collaborate live', desc: 'Everyone joins the same canvas. Cursors, edits, and comments sync instantly.' },
  { n: '3', title: 'Ship with clarity', desc: 'AI turns decisions and action items into a live task board — no copy-paste.' },
];

const stack = ['Next.js 14', 'Y.js CRDT', 'TypeScript', 'PostgreSQL', 'Tailwind CSS', 'WebSockets'];

export default function Home() {
  const demoRoom = env.defaultRoom;

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-neutral-950">
      {/* Nav */}
      <header className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-neutral-900">
        <span className="text-lg font-semibold tracking-tight">LIGMA</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-8 px-6 py-24 text-center">
        <div className="space-y-4">
          <h1 className="text-6xl font-semibold tracking-tight">
            {"Let's Integrate Groups,"}<br />
            <span className="text-neutral-400">Manage Anything.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-neutral-500">
            Real-time collaborative whiteboard that bridges ideation and execution —
            with AI-powered task extraction, CRDT conflict resolution, and node-level access control.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/room/${demoRoom}`}
            className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Try live demo →
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-neutral-200 px-6 py-3 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Create account
          </Link>
        </div>
        <p className="font-mono text-xs text-neutral-400">
          demo room · <span className="text-neutral-600 dark:text-neutral-300">{demoRoom}</span>
        </p>
      </section>

      {/* Features */}
      <section className="border-t border-neutral-100 px-6 py-20 dark:border-neutral-900">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-semibold">Everything your team needs</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-neutral-100 p-6 dark:border-neutral-800">
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm text-neutral-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-neutral-100 bg-neutral-50 px-6 py-20 dark:border-neutral-900 dark:bg-neutral-900/30">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-2xl font-semibold">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="space-y-2 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white dark:bg-white dark:text-neutral-900">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-neutral-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack badges */}
      <section className="border-t border-neutral-100 px-6 py-16 dark:border-neutral-900">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-neutral-400">Built with</p>
          <div className="flex flex-wrap justify-center gap-3">
            {stack.map((s) => (
              <span key={s} className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium dark:border-neutral-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-neutral-100 px-6 py-16 text-center dark:border-neutral-900">
        <h2 className="mb-4 text-2xl font-semibold">Ready to ship?</h2>
        <Link
          href="/signup"
          className="inline-block rounded-md bg-neutral-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          Get started for free
        </Link>
      </section>
    </div>
  );
}
