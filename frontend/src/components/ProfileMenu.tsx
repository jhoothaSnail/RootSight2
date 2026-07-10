import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ViewState } from '../types';

interface ProfileMenuProps {
  onNavigate: (view: ViewState) => void;
  /** Dropdown opens below the avatar (header placement) or above it (sidebar-footer placement). */
  dropDirection?: 'down' | 'up';
  /** Hide when already inside the workspace shell (App.tsx sidebar) — the nav already covers this. */
  showGoToWorkspace?: boolean;
  /** Extra parent-local cleanup to run before sign-out (e.g. Home.tsx resetting its own view state). */
  onBeforeSignOut?: () => void;
}

// Single source of truth for the account avatar + sign-out control so it can't
// drift out of sync between the landing header and the authenticated app shell
// the way it previously did (profile was only ever rendered on the Home page).
export default function ProfileMenu({
  onNavigate,
  dropDirection = 'down',
  showGoToWorkspace = true,
  onBeforeSignOut,
}: ProfileMenuProps) {
  const { isDemo, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setOpen(false);
    onBeforeSignOut?.();
    try {
      await logout();
    } catch {
      // State is already local-only past this point; nothing else to do.
    }
    onNavigate('home');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-bold text-sm uppercase tracking-wider ring-1 ring-zinc-800 hover:ring-amber-500/60 transition-all shrink-0"
        aria-label="Account menu"
      >
        {isDemo ? 'D' : 'U'}
      </button>
      {open && (
        <div
          className={`absolute right-0 ${dropDirection === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'} w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl shadow-black/40 py-2 z-50`}
        >
          <div className="px-4 py-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Signed in</p>
            <p className="text-sm text-zinc-200 font-medium truncate">
              {isDemo ? 'Demo Workspace' : 'Your Workspace'}
            </p>
          </div>
          {showGoToWorkspace && (
            <button
              onClick={() => {
                setOpen(false);
                onNavigate('dashboard');
              }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Go to Workspace
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm font-medium text-red-400/90 hover:bg-zinc-800 hover:text-red-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}