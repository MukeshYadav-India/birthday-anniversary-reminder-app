import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push protocol implementation
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  // For web push, we need to create a JWT and encrypt the payload
  // Using the simplified approach with fetch to the push endpoint
  
  const encoder = new TextEncoder();
  
  // Create VAPID JWT
  const header = { typ: 'JWT', alg: 'ES256' };
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 3600,
    sub: 'mailto:cherish@lovable.app',
  };
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  // Import private key for signing
  const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  // Send to push service (without encryption for simplicity - title/body in headers approach)
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/json',
      'Content-Length': '0',
      'TTL': '86400',
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed (${response.status}): ${text}`);
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = tomorrow.getMonth() + 1;
    const day = tomorrow.getDate();

    // Find events happening tomorrow (match month and day regardless of year)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*');

    if (eventsError) throw eventsError;

    // Filter events where month/day matches tomorrow
    const upcomingEvents = (events || []).filter(event => {
      const eventDate = new Date(event.date + 'T00:00:00');
      return eventDate.getMonth() + 1 === month && eventDate.getDate() === day;
    });

    if (upcomingEvents.length === 0) {
      return new Response(JSON.stringify({ message: 'No events tomorrow', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group events by user
    const eventsByUser: Record<string, typeof upcomingEvents> = {};
    for (const event of upcomingEvents) {
      if (!eventsByUser[event.user_id]) eventsByUser[event.user_id] = [];
      eventsByUser[event.user_id].push(event);
    }

    let sent = 0;
    let errors = 0;

    for (const [userId, userEvents] of Object.entries(eventsByUser)) {
      // Get push subscriptions for this user
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (!subs || subs.length === 0) continue;

      for (const event of userEvents) {
        const eventDate = new Date(event.date + 'T00:00:00');
        const years = tomorrow.getFullYear() - eventDate.getFullYear();
        const typeLabel = event.type === 'birthday' ? `${years}th birthday` : `${years}th anniversary`;
        
        const payload = JSON.stringify({
          title: `🎉 ${event.name}'s ${event.type} is tomorrow!`,
          body: `${event.name}'s ${typeLabel} is tomorrow. Don't forget!`,
          tag: `event-${event.id}`,
        });

        for (const sub of subs) {
          try {
            await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              payload,
              vapidPublicKey,
              vapidPrivateKey
            );
            sent++;
          } catch (e) {
            console.error(`Failed to send to ${sub.endpoint}:`, e);
            errors++;
            // Remove invalid subscriptions
            if (e.message?.includes('410') || e.message?.includes('404')) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Done', sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
