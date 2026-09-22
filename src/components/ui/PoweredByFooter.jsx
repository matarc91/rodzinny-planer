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
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-stone-500/80 font-medium tracking-wide">{APP_VERSION}</span>
        <button
          onClick={async () => {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (const r of regs) await r.unregister();
            }
            if ('caches' in window) {
              const keys = await caches.keys();
              for (const k of keys) await caches.delete(k);
            }
            window.location.reload();
          }}
          className="text-[10px] text-stone-500 hover:text-amber-400 transition underline cursor-pointer"
          title="Wyczyść pamięć podręczną i zaktualizuj aplikację"
        >
          (odśwież wersję)
        </button>
      </div>
    </footer>
  );
}
