import { Loader2, AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

// Shared loading / error / empty presentation primitives so every data-driven
// panel degrades gracefully and consistently with the RootSight design language.

export function LoadingState({ label = 'Loading intelligence...' }: { label?: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 py-12 text-zinc-500">
      <Loader2 className="w-7 h-7 md:w-8 md:h-8 text-amber-500 animate-spin" />
      <span className="font-mono text-xs md:text-sm uppercase tracking-widest animate-pulse">{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  code,
  onRetry,
}: {
  message: string;
  code?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <div className="w-12 h-12 rounded bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <div className="flex flex-col gap-1">
        {code && (
          <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-red-500/80">{code}</span>
        )}
        <p className="text-sm md:text-base text-zinc-300 max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs md:text-sm font-mono uppercase tracking-wider transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label = 'No data available yet.' }: { label?: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 py-12 text-zinc-600">
      <Inbox className="w-7 h-7 md:w-8 md:h-8 opacity-50" />
      <span className="font-mono text-xs md:text-sm uppercase tracking-widest">{label}</span>
    </div>
  );
}
