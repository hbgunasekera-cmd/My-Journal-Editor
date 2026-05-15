export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. Accept the dynamic fbAccessToken forwarded by your React client
  const { platform, text, imageUrl, link, fbAccessToken } = req.body;
  
  // 2. Prioritize the runtime token, falling back to process.env if needed
  const ACCESS_TOKEN = fbAccessToken || process.env.META_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FB_PAGE_ID;
  const IG_USER_ID = process.env.IG_USER_ID;

  // 3. Set the absolute latest Graph API Version shown on your Meta Dashboard
  const API_VERSION = 'v25.0';

  if (!ACCESS_TOKEN) {
    return res.status(400).json({ error: "Authorization failed: Missing valid Meta Access Token." });
  }

  try {
    if (platform === 'facebook') {
      if (!FB_PAGE_ID) throw new Error("Missing FB_PAGE_ID environment variable.");

      // Facebook Page Publishing (Photo + Caption endpoint)
      const fbUrl = `https://graph.facebook.com/${API_VERSION}/${FB_PAGE_ID}/photos`;
      const fbResponse = await fetch(fbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          message: `${text}\n\n 🔗 Web: ${link}`,
          access_token: ACCESS_TOKEN
        })
      });
      
      const fbData = await fbResponse.json();
      if (fbData.error) throw new Error(fbData.error.message);
      return res.status(200).json({ success: true, id: fbData.id });

    } else if (platform === 'instagram') {
      if (!IG_USER_ID) throw new Error("Missing IG_USER_ID environment variable.");

      // Instagram Publishing is a 2-step process
      
      // Step 1: Create Media Container
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
      
      // Step 2: Publish the Container
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
    }

  } catch (error) {
    console.error("Meta API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}