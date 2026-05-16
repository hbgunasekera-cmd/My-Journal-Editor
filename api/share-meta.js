export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. Unpack data payloads sent by your React client
  const { platform, text, imageUrl, link, fbAccessToken, threadsAccessToken } = req.body;
  
  // 2. Read global environment variables from Vercel
  const IG_USER_ID = process.env.IG_USER_ID;
  const API_VERSION = 'v25.0';

  try {
    // ==========================================
    // INSTAGRAM ROUTE
    // ==========================================
    if (platform === 'instagram') {
      const ACCESS_TOKEN = fbAccessToken || process.env.META_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) {
        return res.status(400).json({ error: "Authorization failed: Missing Instagram token." });
      }
      if (!IG_USER_ID) throw new Error("Missing IG_USER_ID environment variable.");

      // Step 1: Create Instagram Media Container
      const igCreateUrl = `https://graph.facebook.com/${API_VERSION}/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message);
      
      // Step 2: Publish the Instagram Container live
      const igPublishUrl = `https://graph.facebook.com/${API_VERSION}/${IG_USER_ID}/media_publish`;
      const publishRes = await fetch(igPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);
      return res.status(200).json({ success: true, id: publishData.id });

    // ==========================================
    // THREADS ROUTE
    // ==========================================
    } else if (platform === 'threads') {
      const ACCESS_TOKEN = threadsAccessToken || process.env.THREADS_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) {
        return res.status(400).json({ error: "Authorization failed: Missing Threads token." });
      }

      // Step 1: Create Threads Media Container
      const threadsCreateUrl = `https://graph.threads.net/v1.0/me/threads`;
      const createRes = await fetch(threadsCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: imageUrl,
          text: text,
          access_token: ACCESS_TOKEN
        })
      });

      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message);

      // Crucial: Meta needs a brief processing window to download and host your cover image
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Step 2: Publish the Threads Container live
      const threadsPublishUrl = `https://graph.threads.net/v1.0/me/threads_publish`;
      const publishRes = await fetch(threadsPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);
      return res.status(200).json({ success: true, id: publishData.id });
    }

    return res.status(400).json({ error: "Unsupported platform selection." });

  } catch (error) {
    console.error("Meta API Architecture Error:", error);
    return res.status(500).json({ error: error.message });
  }
}