// supabase/functions/twitter-notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 1. Pull Credentials from Supabase Secrets
const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");

// Tokens will be automatically managed by the refresh logic
let ACCESS_TOKEN = "MHBUdUs2ODVfMWljSk9Rbm5XS0ZpYS1wZTJPRkIyd0hOOE10RnZyV2RNTG40OjE3NzgyODAzODQxNjU6MToxOmF0OjE";
const REFRESH_TOKEN = "a29iaC1XV3k4OEQtZ1JMdl9yaGVTSmRiY0ZIM3lsOVV1aU9DcXlFVHFSdERDOjE3NzgyODAzODQxNjU6MTowOnJ0OjE";

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

    // 3. Shortened Message (Fits 280-character limit)
    const place = record.place_name;
    const url = `https://my-journal-viewer.vercel.app/?place=${encodeURIComponent(place)}`;
    const message = `New Adventure: ${place} 🏔️\n\nFull gallery here:\n${url}\n\n#SriLanka #Travel #Drone`;

    // 4. Posting Function Helper
    const postTweet = async (token: string): Promise<Response> => {
      return await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message }),
      });
    };

    console.log("Attempting to post to X...");
    let response = await postTweet(ACCESS_TOKEN);

    // 5. OAuth 2.0 Refresh Logic (If Access Token expired)
    if (response.status === 401) {
      console.log("Token expired. Refreshing...");
      const refreshResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          refresh_token: REFRESH_TOKEN,
          grant_type: "refresh_token",
          client_id: CLIENT_ID || "",
        }),
      });

      if (refreshResponse.ok) {
        const newData = await refreshResponse.json();
        response = await postTweet(newData.access_token);
        console.log("Tweet posted successfully with new token.");
      } else {
        const errorText = await refreshResponse.text();
        throw new Error(`Refresh failed: ${errorText}`);
      }
    }

    const result = await response.json();
    console.log("X API Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { 
      status: response.status,
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