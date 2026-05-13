// api/share-mastodon.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tootText, coverImageUrl, locationName } = req.body;
  
  // CRITICAL: Ensure this is set in Vercel Project Settings -> Environment Variables
  const accessToken = process.env.VITE_MASTODON_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("Missing MASTODON_ACCESS_TOKEN in Vercel Settings");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    let mediaIds = [];

    // 1. Fetch Image
    if (coverImageUrl) {
      try {
        const imageResp = await fetch(coverImageUrl);
        if (imageResp.ok) {
          const arrayBuffer = await imageResp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Prepare Multipart Form Data
          const formData = new FormData();
          // Convert Buffer to Blob with a filename
          const fileBlob = new Blob([buffer], { type: 'image/jpeg' });
          formData.append('file', fileBlob, 'cover.jpg');
          formData.append('description', `Scenic view of ${locationName}`);

          const mediaUpload = await fetch('https://mastodon.social/api/v1/media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData,
          });

          if (mediaUpload.ok) {
            const mediaData = await mediaUpload.json();
            mediaIds.push(mediaData.id);
          } else {
            const errorText = await mediaUpload.text();
            console.error("Mastodon Media Upload Failed:", errorText);
          }
        }
      } catch (e) {
        console.error("Image Fetch/Upload Error:", e.message);
        // We continue even if image fails so the text still posts
      }
    }

    // 2. Post the Status
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

    if (!statusResp.ok) {
      console.error("Mastodon Status API Error:", result);
      return res.status(statusResp.status).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Global Proxy Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}