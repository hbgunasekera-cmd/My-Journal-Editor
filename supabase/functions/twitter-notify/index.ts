// supabase/functions/twitter-notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
let ACCESS_TOKEN = "MHBUdUs2ODVfMWljSk9Rbm5XS0ZpYS1wZTJPRkIyd0hOOE10RnZyV2RNTG40OjE3NzgyODAzODQxNjU6MToxOmF0OjE";
const REFRESH_TOKEN = "a29iaC1XV3k4OEQtZ1JMdl9yaGVTSmRiY0ZIM3lsOVV1aU9DcXlFVHFSdERDOjE3NzgyODAzODQxNjU6MTowOnJ0OjE";

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    
    // --- DEBUG LOGS ---
    console.log("Full Payload Received:", JSON.stringify(payload));
    const { record, old_record } = payload;
    console.log(`Checking Status - New: ${record?.status}, Old: ${old_record?.status}`);
    // ------------------

    if (record.status !== 'done' || old_record?.status === 'done') {
      console.log("Logic Exit: Status is not transitioning to 'done'.");
      return new Response("Skipped", { status: 200 });
    }

    const message = `New Adventure Added: ${record.place_name} 🏔️\n\nExplore here:\nhttps://my-journal-view.vercel.app/?place=${encodeURIComponent(record.place_name)}`;

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

    console.log("Attempting X API Post...");
    let response = await postTweet(ACCESS_TOKEN);

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
        console.log("Successfully posted with refreshed token.");
      }
    }

    const result = await response.json();
    console.log("Final X Response:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { 
      status: response.status,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});