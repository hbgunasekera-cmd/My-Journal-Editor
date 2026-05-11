import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. Setup Environment Configuration
const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    // 2. Trigger Logic: Only fire on first transition to 'done'
    if (record.status !== 'done' || old_record?.status === 'done') {
      return new Response("Skipped: No valid 'done' transition.", { status: 200 });
    }

    console.log(`Processing automated post for: ${record.place_name}`);

    // 3. FETCH the current rotating token from the Database
    const { data: creds, error: fetchError } = await supabase
      .from('credentials')
      .select('password')
      .eq('user_id', 'twitter_bot')
      .single();

    if (fetchError || !creds) {
      throw new Error("Missing 'twitter_bot' credentials in database table.");
    }

    // 4. Authorize with X API using Basic Auth
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
      throw new Error(`X API Refresh Failed: ${JSON.stringify(tokenData)}`);
    }

    // 5. AUTO-PERSIST the new refresh token (Self-Healing logic)
    const { error: updateError } = await supabase
      .from('credentials')
      .update({ 
        password: tokenData.refresh_token,
        role: 'bot'
      })
      .eq('user_id', 'twitter_bot');

    if (updateError) console.error("Database Update Warning:", updateError.message);

    // 6. Post the Adventure to X
    const url = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(record.place_name)}`;
    const message = `New Adventure: ${record.place_name} 🏔️\n\nFull gallery here:\n${url}\n\n#SriLanka #Travel #Drone`;

    console.log(`Sending Tweet to X: ${record.place_name}`);
    const postResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    // CRITICAL: Await result to prevent the 402/Shutdown from killing the request
    const postResult = await postResponse.json();
    
    if (!postResponse.ok) {
      console.error("X API Rejected the Post:", JSON.stringify(postResult));
      throw new Error(`X Post Failed: ${postResult.detail || 'Forbidden/Duplicate'}`);
    }

    console.log("X POST SUCCESSFUL! Tweet ID:", postResult.data.id);

    return new Response(JSON.stringify(postResult), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Critical Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
});