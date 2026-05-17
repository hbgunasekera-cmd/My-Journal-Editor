export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { platform, text, imageUrl, fbAccessToken, threadsAccessToken } = req.body;
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    // 🔥 THE MASTER FIX: Create a direct proxy link using your own Vercel server
    // Note: Vercel automatically provides the host header in production
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host; 
    
    // This creates a URL that looks like: https://my-journal.vercel.app/api/ig-image-proxy?url=photos.app.goo.gl/...
    const unblockableImageUrl = `${protocol}://${host}/api/ig-image-proxy?url=${encodeURIComponent(imageUrl)}`;

    // ==========================================
    // INSTAGRAM ROUTE
    // ==========================================
    if (platform === 'instagram') {
      const ACCESS_TOKEN = fbAccessToken || process.env.META_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) return res.status(400).json({ error: "Missing Instagram token." });

      // Step 1: Create Instagram Media Container
      const igCreateUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: unblockableImageUrl, // 💡 Instagram hits your proxy, avoiding Google completely!
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      
      if (createData.error) {
        throw new Error(`Container Creation Failed: ${createData.error.message}`);
      }
      if (!createData.id) throw new Error("Media ID not returned. Check proxy logs.");
      
      // Step 2: Publish the Container
      const igPublishUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media_publish`;
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
      if (!ACCESS_TOKEN) return res.status(400).json({ error: "Missing Threads token." });

      const threadsCreateUrl = `https://graph.threads.net/v1.0/me/threads`;
      const createRes = await fetch(threadsCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: unblockableImageUrl, // 💡 Threads hits your proxy too!
          text: text,
          access_token: ACCESS_TOKEN
        })
      });

      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message);

      await new Promise(resolve => setTimeout(resolve, 6000));

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
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}