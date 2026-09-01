import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

// Klucze VAPID skonfigurowane w Secrets
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BO8-dI3zfjiVL76KjpiwgQYNLvDKGqrPyrWUV4RotrVqMPZsHBaegbv-9vxlKHalZmPTYTl2yd17kxPJdauIjI8";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "3wjNsNQ5_kfV5jb90DQ57VG0e35dRBLWSucOP1qmYQs";
const VAPID_SUBJECT = "mailto:kontakt@syncup.pl";

if (VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn("Błąd setVapidDetails:", err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Funkcja zwracająca aktualną datę i czas w polskiej strefie czasowej (Europe/Warsaw)
function getPolishDateTime() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  // Obiekt Date reprezentujący polski czas lokalny
  const localDate = new Date(year, month - 1, day, hour, minute, second);

  // Jutro w polskim czasie
  const tomorrowDate = new Date(year, month - 1, day + 1, hour, minute, second);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  return { dateStr, timeStr, localDate, tomorrowStr };
}

serve(async (req) => {
  // Obsługa preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // =========================================================================
    // TRYB 1: CRON_CHECK (Automatyczne sprawdzanie terminów w chmurze co minutę)
    // =========================================================================
    if (rawBody.mode === "cron_check") {
      const { dateStr: today, tomorrowStr: tomorrow, localDate: nowLocal } = getPolishDateTime();

      // Pobieramy stany wszystkich rodzin
      const { data: familyStates, error: stateErr } = await supabase
        .from("family_state")
        .select("family_id, data");

      if (stateErr || !familyStates) {
        return new Response(JSON.stringify({ error: stateErr?.message || "No states" }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let sentCount = 0;
      const logs: string[] = [];

      for (const fs of familyStates) {
        const data = fs.data || {};
        const familyId = fs.family_id;
        const sentReminderKeys = { ...(data.sentReminderKeys || {}) };
        let stateModified = false;

        // 1. Sprawdzanie wydarzeń
        const events = data.events || [];
        for (const ev of events) {
          const reminderHours = ev.reminder?.hours ?? ev.reminderHours;
          if (reminderHours === null || reminderHours === undefined) continue;

          for (const targetDate of [today, tomorrow]) {
            if (Array.isArray(ev.excludedDates) && ev.excludedDates.includes(targetDate)) {
              continue;
            }

            let isMatchingDate = false;
            if (targetDate >= ev.date) {
              const freq = ev.recurrence?.freq || 'none';
              if (freq === 'none') {
                if (ev.endDate && ev.endDate >= ev.date) {
                  isMatchingDate = targetDate >= ev.date && targetDate <= ev.endDate;
                } else {
                  isMatchingDate = targetDate === ev.date;
                }
              } else if (freq === 'daily') {
                isMatchingDate = true;
              } else if (freq === 'weekly') {
                isMatchingDate = new Date(targetDate).getDay() === new Date(ev.date).getDay();
              } else if (freq === 'biweekly') {
                const diffDays = Math.round((new Date(targetDate).getTime() - new Date(ev.date).getTime()) / (1000 * 60 * 60 * 24));
                isMatchingDate = diffDays >= 0 && diffDays % 14 === 0;
              } else if (freq === 'quadweekly') {
                const diffDays = Math.round((new Date(targetDate).getTime() - new Date(ev.date).getTime()) / (1000 * 60 * 60 * 24));
                isMatchingDate = diffDays >= 0 && diffDays % 28 === 0;
              }
            }

            if (isMatchingDate) {
              const timeStr = ev.time || "09:00";
              const [yh, mh, dh] = targetDate.split('-').map(Number);
              const [hh, mm] = timeStr.split(':').map(Number);
              const eventDate = new Date(yh, mh - 1, dh, hh, mm, 0);

              const reminderDate = new Date(eventDate.getTime() - (Number(reminderHours) * 60 * 60 * 1000));
              const diffMinutes = (nowLocal.getTime() - reminderDate.getTime()) / (60 * 1000);

              // Sprawdzamy okno czasowe (maksymalnie 4 minuty)
              if (diffMinutes >= 0 && diffMinutes <= 4.0) {
                const logKey = `cron_ev_${ev.id}_${targetDate}_${reminderHours}_${timeStr}`;

                // BLOKADA 1: Czy wysłano już w stanie rodziny?
                if (sentReminderKeys[logKey]) {
                  continue;
                }

                // BLOKADA 2: Czy wysłano w tabeli sent_push_logs?
                const isAlreadySent = await hasLogKey(supabase, logKey);
                if (isAlreadySent) {
                  sentReminderKeys[logKey] = new Date().toISOString();
                  stateModified = true;
                  continue;
                }

                // Oznaczamy natychmiast, aby żaden współbieżny proces nie powtórzył wysyłki
                sentReminderKeys[logKey] = new Date().toISOString();
                stateModified = true;
                await markLogKey(supabase, logKey);

                const title = "Nadchodzące wydarzenie 🔔";
                const body = reminderHours === 0
                  ? `Nadszedł czas wydarzenia: "${ev.title}" (${timeStr})`
                  : `Przypomnienie: "${ev.title}" o ${timeStr}`;

                logs.push(`Wysyłanie wydarzenia: ${ev.title} (${logKey}) do rodziny ${familyId}`);
                await sendPushToFamily(supabase, familyId, title, body, undefined, "/", ev.personIds, logKey);
                sentCount++;
              }
            }
          }
        }

        // 2. Sprawdzanie zadań
        const tasks = data.tasks || [];
        for (const t of tasks) {
          const reminderHours = t.reminder?.hours ?? t.reminderHours;
          if (reminderHours === null || reminderHours === undefined) continue;

          // Jeśli zadanie jest już oznaczone jako zrobione, pomijamy
          const completions = t.completions || {};
          if (completions[today] || completions['once']) continue;

          const targetDateStr = t.dueDate || today;
          if (targetDateStr === today || targetDateStr === tomorrow) {
            const timeStr = t.time || "09:00";
            const [yh, mh, dh] = targetDateStr.split('-').map(Number);
            const [hh, mm] = timeStr.split(':').map(Number);
            const taskDate = new Date(yh, mh - 1, dh, hh, mm, 0);

            const reminderDate = new Date(taskDate.getTime() - (Number(reminderHours) * 60 * 60 * 1000));
            const diffMinutes = (nowLocal.getTime() - reminderDate.getTime()) / (60 * 1000);

            if (diffMinutes >= 0 && diffMinutes <= 4.0) {
              const logKey = `cron_task_${t.id}_${targetDateStr}_${reminderHours}_${timeStr}`;

              // BLOKADA 1: Czy wysłano już w stanie rodziny?
              if (sentReminderKeys[logKey]) {
                continue;
              }

              // BLOKADA 2: Czy wysłano w tabeli sent_push_logs?
              const isAlreadySent = await hasLogKey(supabase, logKey);
              if (isAlreadySent) {
                sentReminderKeys[logKey] = new Date().toISOString();
                stateModified = true;
                continue;
              }

              // Oznaczamy natychmiast, aby żaden współbieżny proces nie powtórzył wysyłki
              sentReminderKeys[logKey] = new Date().toISOString();
              stateModified = true;
              await markLogKey(supabase, logKey);

              const title = "Przypomnienie o zadaniu 📝";
              const body = reminderHours === 0
                ? `Nadszedł czas na zadanie: "${t.title}"`
                : `Przypomnienie: "${t.title}" (termin: ${timeStr})`;

              logs.push(`Wysyłanie zadania: ${t.title} (${logKey}) do rodziny ${familyId}`);
              await sendPushToFamily(supabase, familyId, title, body, undefined, "/", t.personIds, logKey);
              sentCount++;
            }
          }
        }

        // Jeśli wysłano jakiekolwiek przypomnienie, aktualizujemy sentReminderKeys w family_state
        if (stateModified) {
          // Usuwamy klucze starsze niż 7 dni żeby nie powiększać stanu bez końca
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          for (const [k, time] of Object.entries(sentReminderKeys)) {
            if (new Date(time as string).getTime() < sevenDaysAgo) {
              delete sentReminderKeys[k];
            }
          }
          await supabase
            .from("family_state")
            .update({ data: { ...data, sentReminderKeys } })
            .eq("family_id", familyId);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        mode: "cron_check", 
        sentCount, 
        polishTime: nowLocal.toISOString(),
        logs 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // TRYB 2: BEZPOŚREDNIE POWIADOMIENIE LUB WEBHOOK
    // =========================================================================
    const record = rawBody.record || rawBody;
    const title = record.title || "Rodzinny Planer 🔔";
    const body = record.body || "Nowe powiadomienie dla rodziny";
    const family_id = record.family_id;
    const author_user_id = record.user_id; // Autor do wykluczenia
    const target_person_ids = record.target_person_ids;
    const url = record.url || "/";
    const tag = record.tag || `notif_${Date.now()}`;

    const result = await sendPushToFamily(
      supabase,
      family_id,
      title,
      body,
      author_user_id,
      url,
      target_person_ids,
      tag
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendPushToFamily(
  supabase: any,
  family_id?: string,
  title?: string,
  body?: string,
  author_user_id?: string,
  url = "/",
  target_person_ids?: string[] | null,
  tag?: string
) {
  if (!VAPID_PRIVATE_KEY) {
    console.warn("Brak VAPID_PRIVATE_KEY w Secrets");
    return { success: false, message: "Brak klucza VAPID_PRIVATE_KEY" };
  }

  if (!family_id) {
    return { success: false, message: "Brak family_id" };
  }

  // 1. Pobieramy wszystkie subskrypcje powiązane z daną rodziną
  let query = supabase.from("push_subscriptions").select("*").eq("family_id", family_id);
  const { data: subscriptions, error } = await query;

  if (error || !subscriptions || subscriptions.length === 0) {
    return { success: true, message: "Brak aktywnych subskrypcji dla tej rodziny", delivered: 0, total: 0 };
  }

  // 2. Wykluczamy autora akcji (twórcę), aby nie wysyłać powiadomienia do samego siebie
  let targetSubs = subscriptions.filter((sub: any) => !author_user_id || sub.user_id !== author_user_id);

  // 3. Jeśli podano target_person_ids, filtrujemy według przypisanych członków rodziny
  if (target_person_ids && Array.isArray(target_person_ids) && target_person_ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, person_id")
      .eq("family_id", family_id);

    if (profiles && profiles.length > 0) {
      const allowedUserIds = new Set(
        profiles
          .filter((p: any) => p.person_id && target_person_ids.includes(p.person_id))
          .map((p: any) => p.id)
      );
      targetSubs = targetSubs.filter((sub: any) => allowedUserIds.has(sub.user_id));
    }
  }

  // 4. De-duplikacja subskrypcji po unikalnym endpoint (zapobiega podwójnym powiadomieniom na to samo urządzenie)
  const uniqueSubsMap = new Map<string, any>();
  for (const sub of targetSubs) {
    if (sub.endpoint && !uniqueSubsMap.has(sub.endpoint)) {
      uniqueSubsMap.set(sub.endpoint, sub);
    }
  }
  const finalSubs = Array.from(uniqueSubsMap.values());

  if (finalSubs.length === 0) {
    return { success: true, message: "Brak odbiorców po wykluczeniu autora i filtracji person_id", delivered: 0, total: subscriptions.length };
  }

  const payload = JSON.stringify({
    title: title || "Rodzinny Planer 🔔",
    body: body || "Nowe powiadomienie",
    url: url || "/",
    tag: tag || "rodzinny-planer-notif",
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    finalSubs.map((sub: any) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );

  // Automatyczne czyszczenie wygasłych lub odinstalowanych subskrypcji (HTTP 404 / 410 Gone)
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === "rejected") {
      const err = res.reason;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        console.info(`Usuwanie wygasłej subskrypcji Push: ${finalSubs[i].endpoint}`);
        await supabase.from("push_subscriptions").delete().eq("endpoint", finalSubs[i].endpoint);
      }
    }
  }

  return {
    success: true,
    delivered: results.filter((r: any) => r.status === "fulfilled").length,
    total: finalSubs.length,
  };
}

// Pomocnicza funkcja sprawdzająca czy klucz wysyłki został już zapisany w sent_push_logs
async function hasLogKey(supabase: any, logKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("sent_push_logs")
      .select("id")
      .eq("log_key", logKey)
      .limit(1);

    if (!error && data && data.length > 0) {
      return true;
    }
  } catch (e) {
    console.warn("Błąd podczas sprawdzania log_key w bazie:", e);
  }
  return false;
}

// Pomocnicza funkcja zapisująca wysłany klucz w sent_push_logs
async function markLogKey(supabase: any, logKey: string): Promise<void> {
  try {
    await supabase
      .from("sent_push_logs")
      .upsert({ log_key: logKey }, { onConflict: "log_key" });
  } catch (e) {
    console.warn("Błąd podczas zapisu log_key do bazy:", e);
  }
}
