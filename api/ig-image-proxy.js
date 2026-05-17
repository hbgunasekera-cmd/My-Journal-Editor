// api/ig-image-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing image URL parameter" });
  }

  try {
    // 1. Download the Google Photo using the exact Mastodon User-Agent trick
    const imageResp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!imageResp.ok) {
      throw new Error(`Upstream fetch failed: ${imageResp.statusText}`);
    }

    // 2. Convert to binary buffer
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Serve the buffer strictly as a direct JPEG image file for Instagram's scraper
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);

  } catch (error) {
    console.error("Proxy Error:", error.message);
    res.status(500).send("Error streaming image proxy.");
  }
}