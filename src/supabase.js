import { createClient } from '@supabase/supabase-js';

const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      return import.meta.env[key] || '';
    }
  } catch {
    // Ignore env error
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

const createMockSupabase = () => {
  const LISTENERS = new Set();

  const getStoredData = (key, defaultVal) => {
    try {
      const v = localStorage.getItem(`rodzinny_planer_${key}`);
      return v ? JSON.parse(v) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const setStoredData = (key, val) => {
    try {
      localStorage.setItem(`rodzinny_planer_${key}`, JSON.stringify(val));
    } catch {
      // Ignore storage errors
    }
  };

  const getMockSession = () => getStoredData('session', null);
  const setMockSession = (session) => {
    setStoredData('session', session);
    LISTENERS.forEach((cb) => cb('SIGNED_IN', session));
  };

  return {
    auth: {
      async getSession() {
        return { data: { session: getMockSession() }, error: null };
      },
      onAuthStateChange(callback) {
        LISTENERS.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                LISTENERS.delete(callback);
              },
            },
          },
        };
      },
      async signInWithPassword({ email }) {
        const user = { id: `usr_${Date.now()}`, email };
        const session = { user, token: 'mock_token' };
        setMockSession(session);
        return { data: { session, user }, error: null };
      },
      async signUp({ email }) {
        const user = { id: `usr_${Date.now()}`, email };
        const session = { user, token: 'mock_token' };
        setMockSession(session);
        return { data: { session, user }, error: null };
      },
      async signOut() {
        setStoredData('session', null);
        LISTENERS.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      },
      async updateUser(attributes) {
        const session = getMockSession();
        if (session && session.user) {
          if (attributes.password) {
            session.user.password_updated = true;
          }
          setStoredData('session', session);
          return { data: { user: session.user }, error: null };
        }
        return { data: null, error: { message: 'Brak aktywnej sesji' } };
      },
      async resetPasswordForEmail(email) {
        if (!email || !email.includes('@')) {
          return { data: null, error: { message: 'Wprowadź poprawny adres e-mail.' } };
        }
        return { data: {}, error: null };
      },
    },
    from(table) {
      return {
        select() {
          return {
            eq(col, val) {
              return {
                async single() {
                  const rows = getStoredData(table, []);
                  const found = rows.find((r) => r[col] === val);
                  if (!found && table === 'family_state') {
                    return { data: null, error: { code: 'PGRST116' } };
                  }
                  return { data: found || null, error: found ? null : { code: 'PGRST116', message: 'Not found' } };
                },
                async select() {
                  return this;
                },
              };
            },
            async single() {
              const rows = getStoredData(table, []);
              return { data: rows[0] || null, error: rows[0] ? null : { code: 'PGRST116' } };
            },
          };
        },
        insert(data) {
          const rows = getStoredData(table, []);
          const items = Array.isArray(data) ? data : [data];
          const newRows = [...rows, ...items];
          setStoredData(table, newRows);
          const singleItem = items[0];
          return {
            select() {
              return {
                async single() {
                  return { data: singleItem, error: null };
                },
              };
            },
            async single() {
              return { data: singleItem, error: null };
            },
          };
        },
        upsert(data) {
          const rows = getStoredData(table, []);
          const id = data.id || data.family_id;
          const idx = rows.findIndex((r) => (r.id && r.id === id) || (r.family_id && r.family_id === id));
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...data };
          } else {
            rows.push(data);
          }
          setStoredData(table, rows);
          return { data, error: null };
        },
        update(data) {
          return {
            async eq(col, val) {
              const rows = getStoredData(table, []);
              const updated = rows.map((r) => (r[col] === val ? { ...r, ...data } : r));
              setStoredData(table, updated);
              return { data, error: null };
            },
          };
        },
        delete() {
          return {
            async eq(col, val) {
              const rows = getStoredData(table, []);
              const filtered = rows.filter((r) => r[col] !== val);
              setStoredData(table, filtered);
              return { error: null };
            },
          };
        },
      };
    },
    channel() {
      return {
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      };
    },
    removeChannel() {},
  };
};

export const getSupabaseClient = () => {
  if (isSupabaseConfigured) {
    try {
      return createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
      console.warn('Failed to initialize real Supabase client, using local storage fallback.', e);
      return createMockSupabase();
    }
  }
  return createMockSupabase();
};

