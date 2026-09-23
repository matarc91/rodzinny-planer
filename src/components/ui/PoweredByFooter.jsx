import { APP_VERSION } from '../../utils/constants.js';

export function PoweredByFooter({ className = '' }) {
  return (
    <footer className={`mt-auto pt-8 pb-3 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-1 shrink-0 select-none ${className}`}>
      <div className="flex items-center justify-center gap-1.5">
        <span>Powered by</span>
        <a
          href="https://syncup.pl"
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-400 hover:text-amber-400 transition font-medium underline decoration-stone-700 underline-offset-2"
        >
          syncup.pl
        </a>
      </div>
      <span className="text-[11px] font-mono text-stone-500/80 font-medium tracking-wide">{APP_VERSION}</span>
    </footer>
  );
}
