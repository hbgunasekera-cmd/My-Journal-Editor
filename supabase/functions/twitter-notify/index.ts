// supabase/functions/twitter-notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 1. Pull Credentials from Supabase Secrets
const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
const REFRESH_TOKEN = Deno.env.get("X_REFRESH_TOKEN"); 

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    // --- DEBUG LOGS ---
    console.log(`Processing: ${record?.place_name || 'Unknown'}`);
    console.log(`Status Change: ${old_record?.status || 'null'} -> ${record?.status}`);

    // 2. Trigger Logic: Only fire on first transition to 'done'
    if (record.status !== 'done' || old_record?.status === 'done') {
      console.log("Logic Exit: No valid 'done' transition detected.");
      return new Response("Skipped", { status: 200 });
    }

    // 3. Construct Message
    const place = record.place_name;
    const url = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(place)}`;
    const message = `New Adventure: ${place} 🏔️\n\nFull gallery here:\n${url}\n\n#SriLanka #Travel #Drone`;

    // 4. OAuth 2.0 Token Refresh Function
    // This uses the Basic Auth fix (Client ID + Client Secret) encoded to Base64
    const getNewTokens = async () => {
      console.log("Refreshing X tokens...");
      const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
      
      const response = await fetch("https://api.twitter.com/2/oauth2/token", {
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Refresh failed: ${errorText}`);
      }
      return await response.json();
    };

    // 5. Execution Flow
    const tokenData = await getNewTokens();
    
    console.log("Attempting to post to X...");
    const postResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    const result = await postResponse.json();
    
    if (postResponse.ok) {
      console.log("Tweet posted successfully!");
    } else {
      console.error("X API Error:", JSON.stringify(result));
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