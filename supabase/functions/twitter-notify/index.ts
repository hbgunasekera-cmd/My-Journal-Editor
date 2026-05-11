import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CLIENT_ID = Deno.env.get("X_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET");
const REFRESH_TOKEN = Deno.env.get("X_REFRESH_TOKEN");

serve(async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    // Trigger Logic: Only fire on first transition to 'done'
    if (record.status !== 'done' || old_record?.status === 'done') {
      return new Response("Skipped", { status: 200 });
    }

    // Prepare Token Refresh
    console.log("Authorizing with X API...");
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    
    const refreshResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`, // This solves the 'unauthorized_client' error
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

    // Post to X
    const message = `New Adventure: ${record.place_name} 🏔️\n\nFull gallery here:\nhttps://my-journal-view.vercel.app/?place=${encodeURIComponent(record.place_name)}\n\n#SriLanka #Travel #Drone`;

    const postResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    const result = await postResponse.json();
    console.log("Post Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { status: 200 });

  } catch (error: any) {
    console.error("Critical Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});