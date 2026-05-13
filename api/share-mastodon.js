// api/share-mastodon.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tootText, coverImageUrl, locationName } = req.body;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: "MASTODON_ACCESS_TOKEN is not configured in Vercel" });
  }

  try {
    let mediaIds = [];

    // 1. Fetch the Image
    if (coverImageUrl) {
      try {
        const imageResp = await fetch(coverImageUrl);
        if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
        
        const arrayBuffer = await imageResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Prepare FormData for the Mastodon Media API
        const formData = new FormData();
        
        // We create a Blob from the buffer and must provide a filename ('cover.jpg')
        // Mastodon's API uses the filename to determine the upload is a file.
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
          console.error("Mastodon Media API Error:", errorText);
        }
      } catch (imgErr) {
        console.error("Image Processing Error:", imgErr.message);
        // We continue so the text post still goes through even if the image fails
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
      return res.status(statusResp.status).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Proxy Global Error:", error);
    return res.status(500).json({ error: error.message });
  }
}