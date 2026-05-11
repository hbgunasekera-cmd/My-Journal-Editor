import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    if (record.status !== 'done' || old_record?.status === 'done') {
      return new Response("Skipped", { status: 200 });
    }

    // 1. Wait for 2 seconds to let any duplicate triggers settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Fetch the current token
    const { data: creds, error: fetchError } = await supabase
      .from('credentials')
      .select('password, updated_at')
      .eq('user_id', 'twitter_bot')
      .single();

    if (fetchError || !creds) throw new Error("DB Fetch failed");

    // 3. Authorization with X
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const refreshResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        refresh_token: creds.password,
        grant_type: "refresh_token",
        client_id: CLIENT_ID!,
      }),
    });

    const tokenData = await refreshResponse.json();
    
    if (!refreshResponse.ok) {
      console.error(`Token used: ${creds.password.substring(0, 10)}...`);
      throw new Error(`X API Reject: ${JSON.stringify(tokenData)}`);
    }

    // 4. Update the DB with the NEW token
    await supabase
      .from('credentials')
      .update({ password: tokenData.refresh_token })
      .eq('user_id', 'twitter_bot');

    // 5. Post to X
    const url = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(record.place_name)}`;
    const message = `New Adventure: ${record.place_name} 🏔️\n\nFull gallery: ${url}\n\n#SriLanka #Travel`;

    const postResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    return new Response("Success", { status: 200 });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(error.message, { status: 500 });
  }
});