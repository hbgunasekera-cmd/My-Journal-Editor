// supabase/functions/twitter-notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 1. Environment Variables (Set these via 'supabase secrets set')
const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");

// Temporary tokens - Refresh logic will handle updates
let ACCESS_TOKEN = "MHBUdUs2ODVfMWljSk9Rbm5XS0ZpYS1wZTJPRkIyd0hOOE10RnZyV2RNTG40OjE3NzgyODAzODQxNjU6MToxOmF0OjE";
const REFRESH_TOKEN = "a29iaC1XV3k4OEQtZ1JMdl9yaGVTSmRiY0ZIM3lsOVV1aU9DcXlFVHFSdERDOjE3NzgyODAzODQxNjU6MTowOnJ0OjE";

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    console.log(`Processing update for: ${record.place_name}`);

    // 2. Trigger Logic: Ensure it's a NEW 'done' status
    if (record.status !== 'done' || old_record?.status === 'done') {
      console.log("Trigger skipped: Status is not transitioning to 'done'.");
      return new Response("No update needed", { status: 200 });
    }

    // 3. Craft the Message
    const message = `New Adventure Added: ${record.place_name} 🏔️\n\nCheck out the full iPhone & Drone gallery here:\nhttps://my-journal-view.vercel.app/?place=${encodeURIComponent(record.place_name)}\n\n#SriLanka #Travel #DronePhotography`;

    // 4. Helper for X API
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

    console.log("Attempting to post tweet...");
    let response = await postTweet(ACCESS_TOKEN);

    // 5. OAuth 2.0 Refresh Logic
    if (response.status === 401) {
      console.log("Access Token expired, attempting refresh...");
      
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
        console.log("Token refreshed. Retrying post...");
        response = await postTweet(newData.access_token);
      } else {
        const errorDetails = await refreshResponse.text();
        throw new Error(`Token refresh failed: ${errorDetails}`);
      }
    }

    const result = await response.json();
    console.log("X API Response:", JSON.stringify(result));

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