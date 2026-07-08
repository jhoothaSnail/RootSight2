import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import WorkspacePreview from './WorkspacePreview';
import { useAuth } from '../context/AuthContext';
import type { ViewState } from '../types';

interface SignupProps {
  onNavigate: (view: ViewState) => void;
}

const PENDING_INTENT_KEY = 'rootsight_pending_initialize';

export default function Signup({ onNavigate }: SignupProps) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in every field.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      // New signups land straight in the Upload Section, same as an
      // in-flight "Initialize Analysis" intent would.
      sessionStorage.setItem(PENDING_INTENT_KEY, '1');
      onNavigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
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
              Create Your Workspace
            </div>

            <h1 className="font-display font-bold tracking-tight text-zinc-100 text-3xl md:text-4xl mb-2">
              Start your free trial.
            </h1>
            <p className="text-zinc-400 font-light mb-8 text-sm md:text-base">
              No credit card required. Your workspace, analyses, and runbooks persist from day one.
            </p>
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
              <label htmlFor="name" className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-500/60 focus:bg-zinc-900"
                />
              </div>
            </div>

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
              <label htmlFor="password" className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-500/60 focus:bg-zinc-900"
                />
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
              {isSubmitting ? 'Creating Workspace...' : 'Create Workspace'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
            </button>

            <p className="text-center text-sm text-zinc-500 mt-2">
              Already have a workspace?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </motion.form>
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
