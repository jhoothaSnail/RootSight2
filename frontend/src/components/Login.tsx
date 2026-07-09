import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Mail, Lock, Eye, EyeOff, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { Logo } from './Logo';
import WorkspacePreview from './WorkspacePreview';
import { useAuth } from '../context/AuthContext';
import type { ViewState } from '../types';

interface LoginProps {
  onNavigate: (view: ViewState) => void;
}

const PENDING_INTENT_KEY = 'rootsight_pending_initialize';

const FEATURE_INDICATORS = [
  'AI Root Cause Analysis',
  'Incident History',
  'Blast Radius Simulation',
  'Dynamic Runbooks',
];

export default function Login({ onNavigate }: LoginProps) {
  const { login, loginDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');

  // If Login was reached mid "Initialize Analysis", send the user back into
  // Home so it can resume straight into the Upload Section. Otherwise land
  // on the Analysis Engine like a normal sign-in.
  const navigateAfterAuth = () => {
    const hadPendingIntent = sessionStorage.getItem(PENDING_INTENT_KEY);
    onNavigate(hadPendingIntent ? 'home' : 'dashboard');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigateAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoWorkspace = async () => {
    setError('');
    setIsDemoLoading(true);
    try {
      await loginDemo();
      navigateAfterAuth();
    } catch {
      setError('Could not start the demo workspace. Please try again.');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex overflow-hidden bg-zinc-950 selection:bg-amber-500/30">
      {/* Left: Form */}
      <div className="w-full lg:w-[46%] relative z-10 flex flex-col px-8 sm:px-14 py-10 overflow-y-auto">
        <div
          className="flex items-center gap-3 cursor-pointer group w-fit"
          onClick={() => onNavigate('home')}
          role="button"
        >
          <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-transform group-hover:scale-105" />
          <span className="font-display font-semibold text-xl tracking-wide text-zinc-100 uppercase">RootSight</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-xs text-zinc-400 uppercase tracking-widest mb-6 backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              Secure Workspace Access
            </div>

            <h1 className="font-display font-bold tracking-tight text-zinc-100 text-3xl md:text-4xl mb-2">
              This is your RootSight workspace.
            </h1>
            <p className="text-zinc-400 font-light mb-5 text-sm md:text-base">
              Sign in to reach your saved analyses, incident history, and runbook library — free to start.
            </p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
              {FEATURE_INDICATORS.map((feature) => (
                <div key={feature} className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                  <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-500/60 focus:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    /* Wired to a real Forgot Password flow in the next phase */
                  }}
                  className="text-xs font-mono text-zinc-500 hover:text-amber-500 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded pl-10 pr-11 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-500/60 focus:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 font-bold uppercase tracking-wider text-sm transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none mt-1"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
            </button>

            <p className="text-center text-sm text-zinc-500 mt-2">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('signup')}
                className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
              >
                Sign up
              </button>
            </p>
          </motion.form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={handleDemoWorkspace}
            disabled={isDemoLoading}
            className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-teal-500/40 text-zinc-300 hover:text-white font-semibold uppercase tracking-wider text-xs transition-all backdrop-blur-sm disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4 text-teal-500" />
            {isDemoLoading ? 'Entering Workspace...' : 'Enter Demo Workspace'}
          </button>
          <p className="text-center text-xs text-zinc-600 mt-3 font-mono uppercase tracking-widest">
            Free Workspace Trial &middot; No Credit Card Required
          </p>
        </div>

        <div className="text-xs font-mono text-zinc-600 uppercase tracking-widest pt-6">
          Encryption: AES-256 &middot; Node ID: a3f9-b82c
        </div>
      </div>

      {/* Right: Brand panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-l border-zinc-900">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] opacity-20" />

        <motion.div
          animate={{ rotate: -360, scale: [1, 1.15, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[10%] right-[-15%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 70%)' }}
        />
        <motion.div
          animate={{ rotate: 360, scale: [1.1, 1, 1.1], opacity: [0.12, 0.18, 0.12] }}
          transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-[-15%] left-[-10%] w-[55vw] h-[55vw] max-w-[600px] max-h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, rgba(20, 184, 166, 0) 70%)' }}
        />

        <WorkspacePreview />
      </div>
    </div>
  );
}

