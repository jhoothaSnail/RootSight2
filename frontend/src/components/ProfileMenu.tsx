import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import type { ViewState } from '../types';

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

interface ProfileMenuProps {
  onNavigate: (view: ViewState) => void;
  /** Dropdown opens below the avatar (header placement) or above it (sidebar-footer placement). */
  dropDirection?: 'down' | 'up';
  /** Anchors the menu to the trigger's left or right edge. Use 'start' when
   *  the trigger sits near the left edge of a narrow rail (e.g. the
   *  collapsed sidebar) — 'end' would push the fixed-width menu off-screen. */
  dropAlign?: 'start' | 'end';
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
  dropAlign = 'end',
  showGoToWorkspace = true,
  onBeforeSignOut,
}: ProfileMenuProps) {
  const { isDemo, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Portal-rendered menus can't rely on CSS `absolute` — they're detached
  // from the sidebar's own box, so we compute a viewport-relative `fixed`
  // position from the trigger's live bounding rect instead. Recomputed
  // whenever the menu opens, on resize, or on scroll of any ancestor
  // (capture:true catches scroll on the sidebar's own overflow-y-auto box,
  // not just window scroll) so the menu never drifts from its anchor.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const next: MenuPosition = {};
    if (dropDirection === 'down') {
      next.top = rect.bottom + 8;
    } else {
      next.bottom = window.innerHeight - rect.top + 8;
    }
    if (dropAlign === 'end') {
      next.right = window.innerWidth - rect.right;
    } else {
      next.left = rect.left;
    }
    setPosition(next);
  }, [dropDirection, dropAlign]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  // Close on outside click (checking both the trigger and the portal-rendered
  // menu, since the menu no longer lives inside the trigger's DOM subtree)
  // so it never feels "stuck" open, and close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

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
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-bold text-sm uppercase tracking-wider ring-1 ring-zinc-800 hover:ring-amber-500/60 transition-all shrink-0"
        aria-label="Account menu"
      >
        {isDemo ? 'D' : 'U'}
      </button>
      {open && position &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              right: position.right,
            }}
            className="w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl shadow-black/40 py-2 z-[100]"
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
          </div>,
          document.body
        )}
    </div>
  );
}