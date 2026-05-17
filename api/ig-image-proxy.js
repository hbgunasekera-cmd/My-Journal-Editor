// api/ig-image-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing image URL parameter" });
  }

  try {
    let targetUrl = url;

    // 1. If it's a short link, follow the redirects to find the real destination page
    if (url.includes("photos.app.goo.gl")) {
      const redirectRes = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      targetUrl = redirectRes.url;
    }

    // 2. Download the destination page HTML using a clean browser signature
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to load Google Photos page metadata: ${pageRes.statusText}`);
    }

    const htmlText = await pageRes.text();

    // 3. Extract the high-resolution OpenGraph image meta tag used by Google for previews
    // This extracts the absolute direct link to the image binary data stream
    const ogImageMatch = htmlText.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        htmlText.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    let binaryImageUrl = null;
    if (ogImageMatch && ogImageMatch[1]) {
      binaryImageUrl = ogImageMatch[1];
    } else {
      // Fallback regex if the OpenGraph tag layout varies
      const fallbackMatch = htmlText.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/);
      if (fallbackMatch) binaryImageUrl = fallbackMatch[0];
    }

    if (!binaryImageUrl) {
      throw new Error("Could not extract raw image stream from Google Photos layout data.");
    }

    // 4. Force optimal dimensions for Instagram/Threads canvas rules (=w2400-h1600)
    if (!binaryImageUrl.includes("=w")) {
      binaryImageUrl = `${binaryImageUrl}=w2400-h1600`;
    }

    // 5. Download the actual binary photo bytes
    const imageResp = await fetch(binaryImageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!imageResp.ok) throw new Error("Failed fetching image file data stream.");

    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6. Return the clean binary file straight to Meta's ingestion bot
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);

  } catch (error) {
    console.error("Proxy Processing Failure:", error.message);
    return res.status(500).send(`Proxy Error: ${error.message}`);
  }
}