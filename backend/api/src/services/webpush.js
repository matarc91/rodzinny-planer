import webpush from 'web-push';
import { query } from '../db.js';

let initialized = false;

export function initWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!pub || !priv || !subject) {
    console.warn('[PUSH] Brak konfiguracji VAPID – Web Push nie będzie działać.');
    return;
  }

  webpush.setVapidDetails(subject, pub, priv);
  initialized = true;
  console.log('[PUSH] Web Push VAPID skonfigurowany.');
}

/**
 * Wysyła Web Push do wszystkich urządzeń rodziny poza autorem akcji.
 * @param {string} familyId
 * @param {string|null} excludeUserId - ID użytkownika który wywołał akcję (nie dostaje powiadomienia)
 * @param {{ title, body, url, tag }} payload
 */
export async function sendPushToFamily(familyId, excludeUserId, payload) {
  if (!initialized) return;

  try {
    const { rows } = await query(
      `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE family_id = $1
         AND ($2::uuid IS NULL OR user_id != $2)`,
      [familyId, excludeUserId || null]
    );

    if (rows.length === 0) return;

    const notification = JSON.stringify({
      title: payload.title || 'Rodzinny Planer',
      body: payload.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.tag || `rp_${Date.now()}`,
      data: { url: payload.url || '/' },
    });

    const results = await Promise.allSettled(
      rows.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { TTL: 60 * 60 * 24 } // 24h
        )
      )
    );

    // Usuń nieaktywne subskrypcje (410 Gone)
    const staleEndpoints = rows
      .filter((_, i) => results[i].status === 'rejected' && results[i].reason?.statusCode === 410)
      .map((s) => s.endpoint);

    if (staleEndpoints.length > 0) {
      await query(
        `DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`,
        [staleEndpoints]
      );
      console.log(`[PUSH] Usunięto ${staleEndpoints.length} wygasłych subskrypcji.`);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[PUSH] Wysłano do ${sent}/${rows.length} urządzeń rodziny ${familyId}.`);
  } catch (err) {
    console.error('[PUSH] Błąd wysyłania Web Push:', err.message);
  }
}
