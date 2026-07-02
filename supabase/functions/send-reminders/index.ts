/**
 * send-reminders  —  Supabase Edge Function
 *
 * Called daily by pg_cron at 09:00 (see SQL migration).
 * Finds every event whose next annual occurrence is exactly 1 OR 3 days away
 * and sends a fully-encrypted web-push notification with event details.
 *
 * Required Supabase Secrets (Dashboard → Settings → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY   — base64url-encoded VAPID public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded VAPID private key
 *   VAPID_SUBJECT      — e.g. "mailto:you@yourdomain.com"
 *
 * To get your VAPID keys, call your existing generate-vapid-keys function once
 * and note the returned public/private key pair, then save them as secrets.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Days before an event to send a reminder notification */
const REMINDER_DAYS = [1, 3];

// ─── Date helpers (exact mirror of client-side getDaysUntil) ─────────────────

function getDaysUntil(dateStr: string, from: Date): number {
  const [, monthStr, dayStr] = dateStr.split("-");
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  const thisYear = from.getUTCFullYear();

  let next = new Date(Date.UTC(thisYear, month, day));
  if (next.getTime() < from.getTime()) {
    next = new Date(Date.UTC(thisYear + 1, month, day));
  }

  const diff = next.getTime() - from.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getAge(dateStr: string, referenceYear: number): number {
  const birth = new Date(dateStr + "T00:00:00");
  return referenceYear - birth.getFullYear();
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    birthday: "Birthday 🎂",
    anniversary: "Anniversary 💍",
    graduation: "Graduation 🎓",
    memorial: "Memorial 🕯️",
  };
  return map[type?.toLowerCase()] ?? `${type} 🎉`;
}

// ─── Web Push: VAPID JWT + payload encryption ────────────────────────────────

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 43200, sub: subject };

  const enc = (obj: object) =>
    b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Import VAPID private key (raw EC private key bytes)
  const pkBytes = b64urlDecode(privateKeyB64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Wrap(pkBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${b64urlEncode(sig)}`;
}

/** Wraps a raw 32-byte EC private key into a PKCS#8 DER envelope */
function pkcs8Wrap(rawKey: Uint8Array): ArrayBuffer {
  // PKCS#8 header for P-256 EC key, then the ECPrivateKey structure
  const header = new Uint8Array([
    0x30, 0x41,             // SEQUENCE
    0x02, 0x01, 0x00,       // version = 0
    0x30, 0x13,             // SEQUENCE (algorithm)
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID prime256v1
    0x04, 0x27,             // OCTET STRING
    0x30, 0x25,             // ECPrivateKey SEQUENCE
    0x02, 0x01, 0x01,       // version = 1
    0x04, 0x20,             // OCTET STRING, 32 bytes
  ]);
  const buf = new Uint8Array(header.length + 32);
  buf.set(header);
  buf.set(rawKey.slice(0, 32), header.length);
  return buf.buffer;
}

/**
 * Encrypt a push payload using the aesgcm scheme (RFC 8291 / Web Push).
 * Returns { ciphertext, salt, serverPublicKey }.
 */
async function encryptPayload(
  payloadStr: string,
  clientPublicKeyB64: string,
  authB64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();

  // Client's public key and auth secret
  const clientPublicKey = b64urlDecode(clientPublicKeyB64);
  const authSecret = b64urlDecode(authB64);

  // Generate ephemeral server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export server public key (uncompressed, 65 bytes)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // Import client public key for ECDH
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256
    )
  );

  // Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const prk = await hkdfExtract(authSecret, sharedSecret);

  // CEK_info = "Content-Encoding: aesgcm\0" + label
  const keyInfo = concat(
    encoder.encode("Content-Encoding: aesgcm\0"),
    new Uint8Array([0x00]),
    context(clientPublicKey, serverPublicKeyRaw)
  );
  const nonceInfo = concat(
    encoder.encode("Content-Encoding: nonce\0"),
    new Uint8Array([0x00]),
    context(clientPublicKey, serverPublicKeyRaw)
  );

  const cek = await hkdfExpand(prk, salt, keyInfo, 16);
  const nonce = await hkdfExpand(prk, salt, nonceInfo, 12);

  // Pad payload: 2-byte length prefix + payload + padding
  const payload = encoder.encode(payloadStr);
  const padLen = 0;
  const padded = new Uint8Array(2 + padLen + payload.length);
  padded[0] = (padLen >> 8) & 0xff;
  padded[1] = padLen & 0xff;
  padded.set(payload, 2 + padLen);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

function context(clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  // "P-256\0" + len(clientKey) + clientKey + len(serverKey) + serverKey
  const label = new TextEncoder().encode("P-256\0");
  const buf = new Uint8Array(label.length + 2 + clientKey.length + 2 + serverKey.length);
  let offset = 0;
  buf.set(label, offset); offset += label.length;
  buf[offset++] = 0; buf[offset++] = clientKey.length;
  buf.set(clientKey, offset); offset += clientKey.length;
  buf[offset++] = 0; buf[offset++] = serverKey.length;
  buf.set(serverKey, offset);
  return buf;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const saltKey = await crypto.subtle.importKey("raw", salt, "HMAC", false, ["sign"]);
  // We use HMAC-SHA256 for HKDF-Extract
  const hmacKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = await crypto.subtle.sign("HMAC", hmacKey, ikm);
  return crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hkdfExpand(
  prk: CryptoKey,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // T(1) = HMAC-Hash(PRK, "" || info || 0x01)
  // But the web push aesgcm scheme uses: HMAC(PRK, salt || info || 0x01) [non-standard]
  const data = concat(salt, info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prk, data));
  return okm.slice(0, length);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ─── FCM helpers ─────────────────────────────────────────────────────────────

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);

  const encodeB64url = (obj: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeB64url({ alg: "RS256", typ: "JWT" })}.${encodeB64url({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned))
  );
  let sigBinary = "";
  for (const b of sigBytes) sigBinary += String.fromCharCode(b);
  const jwt = `${unsigned}.${btoa(sigBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`FCM token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendFcmNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  projectId: string,
  accessToken: string
): Promise<number> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data,
          android: {
            priority: "high",
            notification: { sound: "default", channel_id: "reminders" },
          },
        },
      }),
    }
  );
  return res.status;
}

/** Send a single web-push notification */
async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<number> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payloadStr,
    sub.p256dh,
    sub.auth
  );

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      Encryption: `salt=${b64urlEncode(salt)}`,
      "Crypto-Key": `dh=${b64urlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      TTL: "86400",
    },
    body: ciphertext,
  });

  return response.status;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@cherishreminders.com";
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse(500, {
        error:
          "VAPID keys not set. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as Supabase secrets.",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Load all events ───────────────────────────────────────────────────────
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, user_id, name, type, date, relation");

    if (eventsError) return jsonResponse(500, { error: eventsError.message });

    // ── Filter to events exactly 1 or 3 days away ─────────────────────────────
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // always use UTC midnight to avoid server timezone drift

    // Debug: compute daysUntil for every event so we can see what's happening
    const debugInfo = (events ?? []).map((e) => ({
      name: e.name,
      date: e.date,
      daysUntil: getDaysUntil(e.date, today),
    }));
    console.log("Today UTC:", today.toISOString());
    console.log("Event days:", JSON.stringify(debugInfo));

    const upcoming = (events ?? []).filter((e) =>
      REMINDER_DAYS.includes(getDaysUntil(e.date, today))
    );

    if (upcoming.length === 0) {
      return jsonResponse(200, {
        message: "No reminders to send today.",
        checked: events?.length ?? 0,
        debug: debugInfo,
      });
    }

    // Group by user
    const byUser: Record<string, typeof upcoming> = {};
    for (const event of upcoming) {
      (byUser[event.user_id] ??= []).push(event);
    }

    // ── Load all push subscriptions for affected users (web + native) ──────────
    const { data: allSubs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, platform")
      .in("user_id", Object.keys(byUser));

    if (subsError) return jsonResponse(500, { error: subsError.message });

    // Separate web push and FCM (Android/iOS) subscriptions
    const webSubs = (allSubs ?? []).filter((s) => s.p256dh && s.auth);
    const fcmSubs = (allSubs ?? []).filter((s) => s.platform === "android" || s.platform === "ios");

    // Get FCM access token once if there are Android/iOS subscriptions
    let fcmAccessToken: string | null = null;
    let fcmProjectId: string | null = null;
    if (fcmSubs.length > 0 && fcmServiceAccountJson) {
      try {
        const sa = JSON.parse(fcmServiceAccountJson);
        fcmProjectId = sa.project_id;
        fcmAccessToken = await getFcmAccessToken(fcmServiceAccountJson);
      } catch (err: any) {
        console.error("FCM auth error:", err?.message);
      }
    }

    // ── Send notifications ────────────────────────────────────────────────────
    let sent = 0;
    let skipped = 0;
    const expiredSubIds: string[] = [];

    for (const [userId, userEvents] of Object.entries(byUser)) {
      const userWebSubs = webSubs.filter((s) => s.user_id === userId);
      const userFcmSubs = fcmSubs.filter((s) => s.user_id === userId);

      if (userWebSubs.length === 0 && userFcmSubs.length === 0) {
        skipped += userEvents.length;
        continue;
      }

      for (const event of userEvents) {
        const daysUntil = getDaysUntil(event.date, today);
        const nextYear = today.getFullYear() + (daysUntil <= 3 ? 0 : 1);
        const age = getAge(event.date, nextYear);
        const label = eventTypeLabel(event.type);
        const whoStr = event.relation
          ? `${event.name} (${event.relation})`
          : event.name;

        const yearsStr =
          event.type?.toLowerCase() !== "memorial" && age > 0
            ? ` — turning ${age}`
            : "";

        const notifTitle = `${label}${yearsStr}: ${whoStr}`;
        const notifBody =
          daysUntil === 1
            ? `💝 ${event.name}'s ${event.type} is tomorrow! Time to send your wishes.`
            : `🌟 ${event.name}'s ${event.type} is in 3 days. Don't forget to prepare!`;

        // ── Web push ────────────────────────────────────────────────────────
        const webPayload = JSON.stringify({
          title: notifTitle,
          body: notifBody,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [200, 100, 200],
          tag: `event-${event.id}-${daysUntil}d`,
          data: { eventId: event.id, daysUntil },
        });

        for (const sub of userWebSubs) {
          try {
            const status = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh!, auth: sub.auth! },
              webPayload,
              vapidPublicKey,
              vapidPrivateKey,
              vapidSubject
            );
            if (status === 201 || status === 202) {
              sent++;
            } else if (status === 410 || status === 404) {
              expiredSubIds.push(sub.id);
            } else {
              console.warn(`Web push status ${status} for sub ${sub.id}`);
            }
          } catch (err: any) {
            console.error(`Web push error for sub ${sub.id}:`, err?.message);
          }
        }

        // ── FCM (Android / iOS) ─────────────────────────────────────────────
        if (fcmAccessToken && fcmProjectId) {
          for (const sub of userFcmSubs) {
            try {
              const status = await sendFcmNotification(
                sub.endpoint,
                notifTitle,
                notifBody,
                { eventId: event.id, daysUntil: String(daysUntil) },
                fcmProjectId,
                fcmAccessToken
              );
              if (status === 200) {
                sent++;
              } else if (status === 404) {
                expiredSubIds.push(sub.id);
              } else {
                console.warn(`FCM status ${status} for sub ${sub.id}`);
              }
            } catch (err: any) {
              console.error(`FCM error for sub ${sub.id}:`, err?.message);
            }
          }
        }
      }
    }

    // ── Clean up expired subscriptions ────────────────────────────────────────
    if (expiredSubIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubIds);
    }

    return jsonResponse(200, {
      message: "Reminders processed.",
      checked_events: events?.length ?? 0,
      reminder_events: upcoming.length,
      notifications_sent: sent,
      skipped_no_subscription: skipped,
      expired_cleaned: expiredSubIds.length,
      web_subscriptions: webSubs.length,
      fcm_subscriptions: fcmSubs.length,
    });
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return jsonResponse(500, { error: err?.message ?? "Unknown error" });
  }
});

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
