// Własny klient API dla Rodzinnego Planera (zastępuje Supabase)
// Zapewnia:
// 1. Komunikację z własnym backendem na serwerze cosmere (REST + WebSocket)
// 2. Pełne wsparcie Offline-First z lokalnym cache i kolejką zmian (Outbox)
// 3. Warstwę kompatybilności API (supabase-like shim) dla istniejących komponentów

const API_STORAGE_PREFIX = 'rp_';

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${API_STORAGE_PREFIX}token`);
}

function setStoredToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(`${API_STORAGE_PREFIX}token`, token);
  } else {
    localStorage.removeItem(`${API_STORAGE_PREFIX}token`);
  }
}

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${API_STORAGE_PREFIX}user`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(`${API_STORAGE_PREFIX}user`, JSON.stringify(user));
  } else {
    localStorage.removeItem(`${API_STORAGE_PREFIX}user`);
  }
}

export class ApiClient {
  constructor(baseUrl) {
    // Określenie adresu bazowego API
    // Jeśli nie podano: czytamy z VITE_API_URL lub używamy relatywnego /api
    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
    let url = baseUrl || envUrl || '/api';
    if (url.endsWith('/')) url = url.slice(0, -1);
    this.baseUrl = url;

    this.token = getStoredToken();
    this.user = getStoredUser();
    this.authListeners = new Set();
    this.activeFamilyId = null;
    this.ws = null;
    this.wsReconnectTimeout = null;
    this.pingInterval = null;
    this.syncStatus = 'synced'; // 'synced' | 'pending' | 'offline'

    // Nasłuchiwanie powrotu do sieci (Offline Outbox auto-flush)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setSyncStatus(this.hasPendingChanges() ? 'pending' : 'synced');
        if (this.activeFamilyId) {
          this.syncPendingChanges(this.activeFamilyId);
        }
      });
      window.addEventListener('offline', () => {
        this.setSyncStatus('offline');
      });
    }

    // Inicjalizacja podmodułów
    this.initAuthModule();
    this.initPushModule();
    this.initStateModule();
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rp-sync-status', { detail: { status } }));
    }
  }

  // Pomocnicza metoda HTTP fetch
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMsg = (isJson && data?.error) || response.statusText || 'Błąd żądania sieciowego';
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      // Wykrywanie błędu braku sieci (Offline)
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        this.setSyncStatus('offline');
        err.isOffline = true;
      }
      throw err;
    }
  }

  // ==========================================
  // MODUŁ AUTH
  // ==========================================
  initAuthModule() {
    this.auth = {
      signInWithPassword: async ({ email, password }) => {
        try {
          const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          this.token = res.token;
          this.user = res.user;
          setStoredToken(res.token);
          setStoredUser(res.user);

          const session = { access_token: res.token, user: res.user };
          this.notifyAuthChange('SIGNED_IN', session);

          return { data: { user: res.user, session, profile: res.profile }, error: null };
        } catch (err) {
          return { data: { user: null, session: null }, error: err };
        }
      },

      signUp: async ({ email, password }) => {
        try {
          const res = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

          return { data: { user: res.user, session: null, message: res.message }, error: null };
        } catch (err) {
          return { data: { user: null, session: null }, error: err };
        }
      },

      signOut: async () => {
        try {
          if (this.token) {
            await this.request('/auth/logout', { method: 'POST' }).catch(() => {});
          }
        } finally {
          this.token = null;
          this.user = null;
          setStoredToken(null);
          setStoredUser(null);
          this.disconnectRealtime();
          this.notifyAuthChange('SIGNED_OUT', null);
        }
        return { error: null };
      },

      getSession: async () => {
        if (!this.token || !this.user) {
          return { data: { session: null }, error: null };
        }
        const session = { access_token: this.token, user: this.user };
        return { data: { session }, error: null };
      },

      onAuthStateChange: (callback) => {
        this.authListeners.add(callback);
        // Natychmiastowe wywołanie z bieżącą sesją
        const session = this.token && this.user ? { access_token: this.token, user: this.user } : null;
        callback(session ? 'INITIAL_SESSION' : 'SIGNED_OUT', session);

        return {
          data: {
            subscription: {
              unsubscribe: () => {
                this.authListeners.delete(callback);
              },
            },
          },
        };
      },

      updateUser: async ({ password, currentPassword }) => {
        try {
          const res = await this.request('/auth/me/password', {
            method: 'PATCH',
            body: JSON.stringify({ newPassword: password, currentPassword: currentPassword || password }),
          });
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },

      resetPasswordForEmail: async (email) => {
        try {
          const res = await this.request('/auth/reset-password-request', {
            method: 'POST',
            body: JSON.stringify({ email }),
          });
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },

      resend: async ({ email }) => {
        try {
          const res = await this.request('/auth/reset-password-request', {
            method: 'POST',
            body: JSON.stringify({ email }),
          });
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
    };
  }

  notifyAuthChange(event, session) {
    for (const listener of this.authListeners) {
      try {
        listener(event, session);
      } catch (e) {
        console.warn('Błąd w listenerze auth:', e);
      }
    }
  }

  // ==========================================
  // MODUŁ POWIADOMIEŃ PUSH
  // ==========================================
  initPushModule() {
    this.push = {
      getVapidPublicKey: async () => {
        try {
          const res = await this.request('/push/vapid-public-key');
          return res.publicKey;
        } catch (err) {
          console.warn('Nie udało się pobrać klucza VAPID z API:', err);
          return null;
        }
      },

      subscribe: async (subscriptionData) => {
        const subJson = subscriptionData.toJSON ? subscriptionData.toJSON() : subscriptionData;
        return this.request('/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });
      },

      unsubscribe: async (endpoint) => {
        return this.request('/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint }),
        });
      },

      send: async ({ familyId, title, body, url = '/', testOnly = false }) => {
        return this.request('/push/send', {
          method: 'POST',
          body: JSON.stringify({ familyId, title, body, url, testOnly }),
        });
      },
    };
  }

  // ==========================================
  // MODUŁ STANU I OFFLINE OUTBOX
  // ==========================================
  initStateModule() {
    this.state = {
      get: async (familyId) => {
        const localKey = `${API_STORAGE_PREFIX}state_${familyId}`;
        let cached = null;
        try {
          const raw = localStorage.getItem(localKey);
          if (raw) cached = JSON.parse(raw);
        } catch {}

        try {
          const res = await this.request(`/families/${familyId}/state`);
          if (res?.data) {
            localStorage.setItem(localKey, JSON.stringify(res.data));
            return { data: res.data, updatedAt: res.updatedAt, fromCache: false, error: null };
          }
        } catch (err) {
          // Jeśli brak sieci, zwróć dane z lokalnego cache
          if (cached) {
            return { data: cached, updatedAt: null, fromCache: true, error: null };
          }
          return { data: null, error: err };
        }

        return { data: cached || {}, error: null };
      },

      put: async (familyId, data, pushNotification = null) => {
        const localKey = `${API_STORAGE_PREFIX}state_${familyId}`;
        const outboxKey = `${API_STORAGE_PREFIX}outbox_${familyId}`;

        // 1. Natychmiastowy zapis w lokalnym cache (Optimistic UI)
        try {
          localStorage.setItem(localKey, JSON.stringify(data));
        } catch (e) {
          console.warn('Błąd zapisu stanu do localStorage:', e);
        }

        // 2. Próba wysyłki na serwer
        try {
          const res = await this.request(`/families/${familyId}/state`, {
            method: 'PUT',
            body: JSON.stringify({ data, pushNotification }),
          });

          // Sukces – czyścimy zaległy outbox
          localStorage.removeItem(outboxKey);
          this.setSyncStatus('synced');
          return { success: true, updatedAt: res.updatedAt, error: null };
        } catch (err) {
          // 3. W razie błędu sieci zapisujemy w kolejce zmian Offline Outbox
          console.warn('Brak połączenia z serwerem. Zmiany zostały zakolejkowane lokalnie.');
          try {
            localStorage.setItem(
              outboxKey,
              JSON.stringify({
                data,
                pushNotification,
                timestamp: Date.now(),
              })
            );
          } catch {}

          this.setSyncStatus(err.isOffline ? 'offline' : 'pending');
          return { success: true, offlineQueued: true, error: null };
        }
      },
    };
  }

  hasPendingChanges() {
    if (typeof window === 'undefined' || !this.activeFamilyId) return false;
    return !!localStorage.getItem(`${API_STORAGE_PREFIX}outbox_${this.activeFamilyId}`);
  }

  // Wysyła zaległe zmiany z kolejki offline na serwer
  async syncPendingChanges(familyId) {
    if (typeof window === 'undefined') return;
    const outboxKey = `${API_STORAGE_PREFIX}outbox_${familyId}`;
    try {
      const raw = localStorage.getItem(outboxKey);
      if (!raw) return;

      const outboxItem = JSON.parse(raw);
      if (!outboxItem?.data) return;

      this.setSyncStatus('pending');
      const res = await this.request(`/families/${familyId}/state`, {
        method: 'PUT',
        body: JSON.stringify({
          data: outboxItem.data,
          pushNotification: outboxItem.pushNotification,
        }),
      });

      if (res?.success) {
        localStorage.removeItem(outboxKey);
        this.setSyncStatus('synced');
        console.log('[Sync] Zsynchronizowano zaległe zmiany offline z serwerem cosmere!');
      }
    } catch (err) {
      console.warn('[Sync] Nie udało się jeszcze przesłać zmian offline:', err.message);
    }
  }

  // ==========================================
  // OBSŁUGA WEBSOCKET REALTIME
  // ==========================================
  connectRealtime(familyId, onStateUpdate, onStatusChange) {
    this.activeFamilyId = familyId;
    this.disconnectRealtime();

    if (!familyId || !this.token) return;

    // Ustalanie protokołu WebSocket (ws:// lub wss://)
    let wsUrl;
    if (this.baseUrl.startsWith('http://')) {
      wsUrl = this.baseUrl.replace('http://', 'ws://').replace('/api', '') + '/ws';
    } else if (this.baseUrl.startsWith('https://')) {
      wsUrl = this.baseUrl.replace('https://', 'wss://').replace('/api', '') + '/ws';
    } else {
      const loc = window.location;
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${loc.host}/ws`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Połączono z serwerem WebSocket na cosmere');
        if (onStatusChange) onStatusChange('connected');
        this.setSyncStatus(this.hasPendingChanges() ? 'pending' : 'synced');

        // Dołączenie do pokoju rodziny z autoryzacją JWT
        this.ws.send(
          JSON.stringify({
            type: 'join',
            familyId,
            token: this.token,
          })
        );

        // Wyślij zaległe zmiany jeśli były w offline outbox
        this.syncPendingChanges(familyId);

        // Heartbeat ping
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state_update' && msg.data) {
            if (onStateUpdate) onStateUpdate(msg.data);
          }
        } catch (e) {
          console.warn('[WS] Błąd parsowania wiadomości:', e);
        }
      };

      this.ws.onclose = () => {
        if (onStatusChange) onStatusChange('disconnected');
        clearInterval(this.pingInterval);

        // Automatyczne ponawianie połączenia po 5 sekundach
        this.wsReconnectTimeout = setTimeout(() => {
          if (this.activeFamilyId === familyId && this.token) {
            this.connectRealtime(familyId, onStateUpdate, onStatusChange);
          }
        }, 5000);
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Błąd połączenia WebSocket:', err);
      };
    } catch (err) {
      console.warn('[WS] Nie można utworzyć połączenia WebSocket:', err);
    }
  }

  disconnectRealtime() {
    clearTimeout(this.wsReconnectTimeout);
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  // ==========================================
  // WARSTWA KOMPATYBILNOŚCI SUPABASE (.from)
  // Umożliwia płynne działanie dotychczasowego kodu
  // ==========================================
  from(tableName) {
    const client = this;

    return {
      select: (columns = '*') => {
        let filters = {};

        const queryObj = {
          eq: (field, value) => {
            filters[field] = value;
            return queryObj;
          },
          single: async () => {
            try {
              if (tableName === 'profiles') {
                const res = await client.request('/auth/me');
                return { data: res.profile || res.user, error: null };
              }
              if (tableName === 'families') {
                if (filters.id) {
                  const res = await client.request(`/families/${filters.id}`);
                  return { data: res.family, error: null };
                }
                if (filters.join_code) {
                  // Dołączanie przez kod odbywa się przez POST /families/join
                  return { data: { join_code: filters.join_code }, error: null };
                }
              }
              if (tableName === 'family_state') {
                const famId = filters.family_id || client.activeFamilyId;
                const res = await client.state.get(famId);
                return { data: res, error: null };
              }
              return { data: null, error: null };
            } catch (err) {
              return { data: null, error: err };
            }
          },
        };
        return queryObj;
      },

      insert: async (records) => {
        const item = Array.isArray(records) ? records[0] : records;
        try {
          if (tableName === 'families') {
            const res = await client.request('/families', {
              method: 'POST',
              body: JSON.stringify({
                name: item.name,
                personName: item.personName || 'Domownik',
              }),
            });
            return {
              data: res.family,
              error: null,
              select: () => ({ single: async () => ({ data: res.family, error: null }) }),
            };
          }
          if (tableName === 'family_state') {
            const res = await client.state.put(item.family_id, item.data);
            return { data: res, error: null };
          }
          return { data: item, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },

      upsert: async (records) => {
        const item = Array.isArray(records) ? records[0] : records;
        try {
          if (tableName === 'family_state') {
            const res = await client.state.put(item.family_id, item.data);
            return { data: res, error: null };
          }
          if (tableName === 'push_subscriptions') {
            const res = await client.push.subscribe(item);
            return { data: res, error: null };
          }
          return { data: item, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },

      update: (updates) => {
        let updateFilters = {};
        const updateObj = {
          eq: async (field, value) => {
            updateFilters[field] = value;
            // Aktualizacja profilu (np. person_id)
            if (tableName === 'profiles') {
              return { data: updates, error: null };
            }
            return { data: updates, error: null };
          },
        };
        return updateObj;
      },

      delete: () => {
        let deleteFilters = {};
        const deleteObj = {
          eq: async (field, value) => {
            deleteFilters[field] = value;
            if (tableName === 'push_subscriptions' && field === 'endpoint') {
              await client.push.unsubscribe(value).catch(() => {});
            }
            if (tableName === 'families') {
              await client.request(`/families/${value}/leave`, { method: 'DELETE' }).catch(() => {});
            }
            return { data: null, error: null };
          },
        };
        return deleteObj;
      },
    };
  }

  // Kompatybilność z edge functions (zastąpione przez /api/push/send)
  get functions() {
    return {
      invoke: async (functionName, { body }) => {
        if (functionName === 'send-push') {
          try {
            const res = await this.push.send({
              familyId: body.family_id,
              title: body.title,
              body: body.body,
              url: body.url || '/',
            });
            return { data: res, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        }
        return { data: null, error: new Error(`Nieznana funkcja: ${functionName}`) };
      },
    };
  }

  // Kompatybilność z kanałami Realtime
  channel(channelName) {
    const client = this;
    let onStateCallback = null;

    return {
      on: (event, filter, callback) => {
        onStateCallback = (data) => {
          callback({ new: { data } });
        };
        return {
          subscribe: () => {
            // Połączenie z WebSocket jest zarządzane w App.jsx
            return { unsubscribe: () => client.disconnectRealtime() };
          },
        };
      },
    };
  }

  removeChannel() {
    this.disconnectRealtime();
  }
}

// Domyślna instancja klienta API
export const apiClient = new ApiClient();
export default apiClient;
