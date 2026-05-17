// api/share-meta.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. Unpack data payloads sent by your React client
  const { platform, text, imageUrl, fbAccessToken, threadsAccessToken } = req.body;
  
  // 2. Read global environment variables from Vercel
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    if (!imageUrl) {
      return res.status(400).json({ error: "Missing required imageUrl payload attribute." });
    }

    // 💡 FIXED: Reflects your new unified Vercel project domain name to target the active proxy
    const hostDomain = "https://my-journal-admin.vercel.app";
    const unblockableImageUrl = `${hostDomain}/api/ig-image-proxy?url=${encodeURIComponent(imageUrl)}&ignore=/image.jpg`;

    // ==========================================
    // INSTAGRAM ROUTE (Standalone Graph Engine)
    // ==========================================
    if (platform === 'instagram') {
      const ACCESS_TOKEN = fbAccessToken || process.env.META_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) return res.status(400).json({ error: "Missing Instagram token." });
      if (!IG_USER_ID) return res.status(400).json({ error: "Missing IG_USER_ID environment configuration." });

      // Step 1: Create Instagram Media Container
      const igCreateUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: unblockableImageUrl, // 💡 Routes through your functional proxy
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      
      // DIAGNOSTIC UPGRADE: Bubbles up explicit error codes if Meta rejects parameters
      if (createData.error) {
        return res.status(400).json({
          error: `Meta rejected container creation: ${createData.error.message}`,
          code: createData.error.code,
          subcode: createData.error.error_subcode
        });
      }
      
      if (!createData.id) {
        return res.status(500).json({ error: "No Media ID returned from Meta framework payload mappings." });
      }
      
      // Step 2: Publish the Container live
      const igPublishUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media_publish`;
      const publishRes = await fetch(igPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: createData.id, access_token: ACCESS_TOKEN })
      });

      const publishData = await publishRes.json();
      if (publishData.error) return res.status(400).json({ error: publishData.error.message });
      
      return res.status(200).json({ success: true, id: publishData.id });

    // ==========================================
    // THREADS ROUTE (Dedicated Threads API Engine)
    // ==========================================
    } else if (platform === 'threads') {
      const ACCESS_TOKEN = threadsAccessToken || process.env.THREADS_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) return res.status(400).json({ error: "Authorization failed: Missing Threads token." });

      // Step 1: Create Threads Media Container
      const threadsCreateUrl = `https://graph.threads.net/v1.0/me/threads`;
      const createRes = await fetch(threadsCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: unblockableImageUrl, // 💡 Routes through your functional proxy as well
          text: text,
          access_token: ACCESS_TOKEN
        })
      });

      const createData = await createRes.json();
      if (createData.error) return res.status(400).json({ error: createData.error.message });
      if (!createData.id) return res.status(500).json({ error: "Failed creating Threads post container allocation." });

      // Meta CDN synchronization delay window
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
      if (publishData.error) return res.status(400).json({ error: publishData.error.message });
      return res.status(200).json({ success: true, id: publishData.id });
    }

    return res.status(400).json({ error: "Unsupported platform selection." });

  } catch (error) {
    console.error("Serverless Function Runtime Exception:", error);
    
    let clientErrorMessage = error.message;
    if (clientErrorMessage.includes("access token") || clientErrorMessage.includes("session")) {
      clientErrorMessage = "The session has invalidated. Please check or renew your 60-day authorization tokens.";
    }
    
    return res.status(500).json({ error: clientErrorMessage });
  }
}