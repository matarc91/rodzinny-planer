import { useState, useEffect } from 'react';
import { Terminal, Copy } from 'lucide-react';
import { getLogs, subscribeLogs, clearLogs } from '../utils/logger.js';

export function AppLogsSection() {
  const [logs, setLogs] = useState(getLogs());
  const [filter, setFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeLogs((newLogs) => setLogs(newLogs));
  }, []);

  const filteredLogs = logs.filter((l) => filter === 'all' || l.type === filter);

  const handleCopyLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1E1E22] border border-[#33333C] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-[#33333C] pb-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-stone-100">
          <Terminal size={16} className="text-amber-400" /> Logi Aplikacji i Diagnostyka ({logs.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-lg transition flex items-center gap-1"
          >
            <Copy size={12} /> {copied ? 'Skopiowano!' : 'Kopiuj logi'}
          </button>
          <button
            type="button"
            onClick={() => clearLogs()}
            className="px-2.5 py-1 bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-300 text-xs font-semibold rounded-lg transition"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${
            filter === 'all'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
          }`}
        >
          Wszystkie ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('error')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${
            filter === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
          }`}
        >
          Błędy ({logs.filter((l) => l.type === 'error').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('warn')}
          className={`px-2.5 py-1 rounded-lg transition font-medium ${
            filter === 'warn'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200'
          }`}
        >
          Ostrzeżenia ({logs.filter((l) => l.type === 'warn').length})
        </button>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-xs text-stone-500 py-3 text-center italic">Brak zarejestrowanych zdarzeń w tej sesji.</div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/80 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-stone-500 font-sans">{log.timestamp}</span>
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold font-sans ${
                      log.type === 'error'
                        ? 'bg-red-950 text-red-400 border border-red-900'
                        : log.type === 'warn'
                        ? 'bg-amber-950 text-amber-300 border border-amber-900'
                        : log.type === 'success'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-900'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {log.type}
                  </span>
                  <span className="text-stone-200 break-all font-sans text-xs">{log.message}</span>
                </div>
                {log.details && (
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    className="text-[10px] text-amber-400 hover:underline shrink-0 font-sans"
                  >
                    {expandedLogId === log.id ? 'Ukryj' : 'Szczegóły'}
                  </button>
                )}
              </div>
              {expandedLogId === log.id && log.details && (
                <pre className="text-[10px] text-stone-400 bg-black/40 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap border border-stone-800 mt-1">
                  {log.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
