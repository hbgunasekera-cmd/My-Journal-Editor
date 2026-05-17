// api/ig-image-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing image URL parameter" });
  }

  try {
    // 1. CLEAN THE URL: Force upgrade HTTP to HTTPS to prevent Google redirect loops
    let cleanUrl = url.replace(/^http:\/\//i, 'https://');

    // 2. FORCE RAW FILE STREAM: If it's a googleusercontent link, ensure it requests raw asset bytes
    if (cleanUrl.includes("googleusercontent.com")) {
      // If it doesn't already have a sizing parameter (=w, =s, =h), append =s0 for original full-res file stream
      if (!cleanUrl.includes('=') && !cleanUrl.match(/=[wsh]\d+/)) {
        cleanUrl = `${cleanUrl}=s0`;
      }
    }

    // 3. Mimic a clean browser signature to fetch the raw asset from Google
    const imageResp = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!imageResp.ok) {
      throw new Error(`Google rejected asset request: ${imageResp.status} ${imageResp.statusText}`);
    }

    // 4. Capture the raw binary data buffer
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Explicitly declare the correct image headers so Instagram's scraper recognizes it immediately
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    return res.send(buffer);

  } catch (error) {
    console.error("Proxy Asset Streaming Failure:", error.message);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Proxy Error: ${error.message}`);
  }
}