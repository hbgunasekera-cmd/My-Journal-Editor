import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 1. Pull Credentials from Supabase Secrets
// These must be synced via: supabase secrets set KEY=VALUE
const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
const REFRESH_TOKEN = Deno.env.get("X_REFRESH_TOKEN");

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    // 2. Trigger Logic: Only fire on first transition to 'done'
    if (record.status !== 'done' || old_record?.status === 'done') {
      console.log("Logic Exit: No valid 'done' transition detected.");
      return new Response("Skipped", { status: 200 });
    }

    // 3. Authorize with X API using Basic Auth (Fixes unauthorized_client)
    console.log("Authorizing with X API...");
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    
    const refreshResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`, 
      },
      body: new URLSearchParams({
        refresh_token: REFRESH_TOKEN || "",
        grant_type: "refresh_token",
        client_id: CLIENT_ID || "",
      }),
    });

    if (!refreshResponse.ok) {
      const err = await refreshResponse.text();
      throw new Error(`Refresh failed: ${err}`);
    }

    const tokenData = await refreshResponse.json();

    // 4. Construct Message with your gallery domain
    const place = record.place_name;
    const url = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(place)}`;
    const message = `New Adventure: ${place} 🏔️\n\nFull gallery here:\n${url}\n\n#SriLanka #Travel #Drone`;

    // 5. Post to X
    console.log(`Attempting to post to X: ${place}`);
    const postResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    const result = await postResponse.json();
    
    // 6. Token Rotation Alert
    // X invalidates the old refresh token every time you use it.
    if (tokenData.refresh_token) {
      console.log("--- IMPORTANT: NEW REFRESH TOKEN ISSUED ---");
      console.log("Update X_REFRESH_TOKEN in Supabase Secrets immediately:");
      console.log(tokenData.refresh_token);
      console.log("-------------------------------------------");
    }

    return new Response(JSON.stringify(result), { 
      status: postResponse.status,
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