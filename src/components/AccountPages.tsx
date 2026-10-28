import React, { useState } from 'react';
import { ArrowLeft, Check, LockKeyhole, Mail, ShieldCheck, Sparkles, Users, CreditCard, Activity } from 'lucide-react';

type PageProps = { onNavigate: (path: string) => void };

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50';

function PageShell({ children, onNavigate }: React.PropsWithChildren<PageProps>) {
  return (
    <div className="min-h-screen bg-[#090d16] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => onNavigate('/')} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Mailcraft AI
        </button>
        {children}
      </div>
    </div>
  );
}

export function AccountPage({ onNavigate }: PageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [notice, setNotice] = useState('');
  const isSignup = mode === 'signup';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Account authentication is not connected yet. No account was created and no credentials were sent.');
  }

  return (
    <PageShell onNavigate={onNavigate}>
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/30 lg:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600/30 via-slate-900 to-fuchsia-600/20 p-10 lg:flex">
          <div>
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500"><Sparkles className="h-6 w-6" /></div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Mailcraft AI</p>
            <h1 className="text-4xl font-extrabold leading-tight">Make every campaign sound like you.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">Create marketing campaigns, visual assets, and natural Algerian voice content in one workspace.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Account security is being configured.</div>
        </section>
        <section className="p-6 sm:p-10">
          <div className="mb-8 flex rounded-xl border border-slate-800 bg-slate-950/70 p-1">
            <button onClick={() => { setMode('signup'); setNotice(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${isSignup ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>Create account</button>
            <button onClick={() => { setMode('login'); setNotice(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition ${!isSignup ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>Sign in</button>
          </div>
          <h2 className="text-2xl font-extrabold">{isSignup ? 'Start for free' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-slate-400">{isSignup ? 'Create your workspace in a few steps.' : 'Sign in to continue to your workspace.'}</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {isSignup && <label className="block text-sm font-semibold text-slate-300">Full name<input className={`${inputClass} mt-2`} name="name" autoComplete="name" placeholder="Your name" required /></label>}
            <label className="block text-sm font-semibold text-slate-300">Email address<input className={`${inputClass} mt-2`} type="email" name="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label className="block text-sm font-semibold text-slate-300">Password<input className={`${inputClass} mt-2`} type="password" name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={8} placeholder="At least 8 characters" required /></label>
            {isSignup && <p className="text-xs leading-5 text-slate-500">By continuing, you agree to the Terms of Service and Privacy Policy.</p>}
            <button type="submit" className={primaryButton + ' w-full'}><LockKeyhole className="h-4 w-4" /> {isSignup ? 'Create account' : 'Sign in'} — coming soon</button>
          </form>
          {notice && <p role="status" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{notice}</p>}
          <p className="mt-6 text-xs leading-5 text-slate-500">Authentication is intentionally disabled in this preview until secure server-side sessions and database storage are configured.</p>
        </section>
      </div>
    </PageShell>
  );
}

const plans = [
  { name: 'Free', price: 'Free', description: 'Explore the core creative workflow.', features: ['Access to the campaign workspace', 'Starter usage allowance', 'Standard export options'], featured: false },
  { name: 'Pro', price: 'Price to be confirmed', description: 'For creators and growing teams.', features: ['Higher monthly usage limits', 'Priority generation capacity', 'Advanced campaign workflows'], featured: true },
  { name: 'Business', price: 'Price to be confirmed', description: 'For teams producing campaigns at scale.', features: ['Team-oriented usage allowance', 'Expanded workspace controls', 'Priority support options'], featured: false },
];

export function PricingPage({ onNavigate }: PageProps) {
  return (
    <PageShell onNavigate={onNavigate}>
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Simple, transparent plans</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Choose your creative pace.</h1>
        <p className="mt-4 text-base leading-7 text-slate-400">Start free, then upgrade when your workflow needs more. Prices and usage limits will be confirmed before checkout is enabled.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${plan.featured ? 'border-indigo-400 bg-indigo-500/10 shadow-xl shadow-indigo-950/30' : 'border-slate-800 bg-slate-900/60'}`}>
            {plan.featured && <span className="absolute right-5 top-5 rounded-full bg-indigo-400/15 px-3 py-1 text-xs font-bold text-indigo-200">Popular</span>}
            <h2 className="text-xl font-extrabold">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{plan.description}</p>
            <p className="mt-6 text-2xl font-extrabold">{plan.price}</p>
            <ul className="my-7 flex-1 space-y-4">
              {plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm text-slate-300"><Check className="h-5 w-5 shrink-0 text-emerald-400" />{feature}</li>)}
            </ul>
            <button onClick={() => onNavigate('/signup')} className={plan.featured ? primaryButton + ' w-full' : 'w-full rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800'}>{plan.name === 'Free' ? 'Get started free' : 'Join the plan waitlist'}</button>
          </article>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-500">Checkout is not active yet. Paid subscriptions will only be enabled after a payment provider is selected, payment webhooks are verified, and server-side plan limits are implemented.</p>
    </PageShell>
  );
}

export function AdminPage({ onNavigate }: PageProps) {
  return (
    <PageShell onNavigate={onNavigate}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300"><LockKeyhole className="h-7 w-7" /></div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Restricted area</p>
        <h1 className="mt-3 text-3xl font-extrabold">Administrator console</h1>
        <p className="mt-4 leading-7 text-slate-300">The administrator interface is reserved for authorized accounts. Server-side authentication and role checks are not configured yet, so this preview does not load user data or expose administrative actions.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[{ icon: Users, label: 'User management' }, { icon: CreditCard, label: 'Plans & subscriptions' }, { icon: Activity, label: 'Usage analytics' }].map(({ icon: Icon, label }) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400"><Icon className="mb-3 h-5 w-5 text-slate-500" />{label}<p className="mt-2 text-xs text-slate-600">Locked until server authorization is ready</p></div>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => onNavigate('/login')} className={primaryButton}>Admin sign in</button>
          <button onClick={() => onNavigate('/pricing')} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-800">View plans</button>
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-500">Important: hiding this page in the browser is not sufficient security. Before launch, every admin API must enforce the administrator role on the server.</p>
      </div>
    </PageShell>
  );
}
