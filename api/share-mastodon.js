// api/share-mastodon.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tootText, coverImageUrl, locationName } = req.body;
  
  // This looks for the PRIVATE key (no VITE_ prefix)
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: "MASTODON_ACCESS_TOKEN is missing in Vercel Backend Settings." });
  }

  try {
    let mediaIds = [];

    // 1. UPLOAD IMAGE
    if (coverImageUrl) {
      try {
        const imageResp = await fetch(coverImageUrl);
        if (imageResp.ok) {
          const arrayBuffer = await imageResp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const formData = new FormData();
          const fileBlob = new Blob([buffer], { type: 'image/jpeg' });
          
          // Filename 'cover.jpg' is required for Mastodon's validation
          formData.append('file', fileBlob, 'cover.jpg');
          formData.append('description', `Landscape view of ${locationName}`);

          const mediaUpload = await fetch('https://mastodon.social/api/v1/media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData,
          });

          if (mediaUpload.ok) {
            const mediaData = await mediaUpload.json();
            mediaIds.push(mediaData.id);
          }
        }
      } catch (e) {
        console.error("Image Proxy Error:", e.message);
      }
    }

    // 2. POST STATUS
    const statusResp = await fetch('https://mastodon.social/api/v1/statuses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: tootText,
        media_ids: mediaIds,
        visibility: 'public',
      }),
    });

    const result = await statusResp.json();
    return res.status(statusResp.ok ? 200 : statusResp.status).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}