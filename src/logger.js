// System logowania diagnostycznego dla Rodzinnego Planera

const LOGS_KEY = 'planer_app_logs';
const MAX_LOGS = 100;

let logListeners = [];

export function getLogs() {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLog(type, message, details = null) {
  const logItem = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: type || 'info', // 'info', 'success', 'warn', 'error', 'notif'
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null
  };

  try {
    const currentLogs = getLogs();
    const updated = [logItem, ...currentLogs].slice(0, MAX_LOGS);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    logListeners.forEach(fn => fn(updated));
  } catch (err) {
    console.error('Błąd zapisywania logu:', err);
  }

  // Wypisz też w standardowej konsoli przeglądarki
  const consolePrefix = `[Planer ${logItem.type.toUpperCase()}] ${logItem.message}`;
  if (type === 'error') console.error(consolePrefix, details || '');
  else if (type === 'warn') console.warn(consolePrefix, details || '');
  else console.log(consolePrefix, details || '');

  return logItem;
}

export function clearLogs() {
  try {
    localStorage.removeItem(LOGS_KEY);
    logListeners.forEach(fn => fn([]));
  } catch (err) {
    console.error('Błąd czyszczenia logów:', err);
  }
}

export function subscribeLogs(listener) {
  logListeners.push(listener);
  return () => {
    logListeners = logListeners.filter(fn => fn !== listener);
  };
}

// Globalne chwytanie nieobsłużonych błędów w aplikacji
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    addLog('error', `Błąd JavaScript: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    addLog('error', `Nieobsłużona obietnica (Promise rejection): ${event.reason?.message || event.reason}`, {
      reason: event.reason
    });
  });
}
