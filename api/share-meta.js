// api/share-meta.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { platform, text, imageUrl, fbAccessToken, threadsAccessToken } = req.body;
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    if (!imageUrl) {
      return res.status(400).json({ error: "Missing required imageUrl payload attribute." });
    }

    // 💡 FIXED: Hardcode your production editor domain explicitly to prevent 500 Function Crashes
    const hostDomain = "https://my-journal-editor.vercel.app";
    const unblockableImageUrl = `${hostDomain}/api/ig-image-proxy?url=${encodeURIComponent(imageUrl)}&ignore=/image.jpg`;

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
          image_url: unblockableImageUrl,
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      
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
    }
  } catch (error) {
    console.error("Serverless Function Runtime Exception:", error);
    return res.status(500).json({ error: error.message });
  }
}