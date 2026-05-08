// api/feed.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase using your existing environment variables
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  // 1. Corrected Table Name: Using 'travel_bucket_list' instead of 'locations'
  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`
      id, 
      place_name, 
      created_at, 
      cover_photo_url, 
      ai_article
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // 2. Construct RSS Items with escaped URLs for XML compliance
  const rssItems = places.map(place => {
    // rawUrl matches your deep-linking logic for correct redirects
    const rawUrl = `https://my-journal-viewer.vercel.app/?place=${encodeURIComponent(place.place_name)}&utm_source=rss_feed`;
    
    // FIX: Escape bare ampersands to &amp; to prevent XML Parsing Errors
    const escapedUrl = rawUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
    // Extract story preview from the ai_article jsonb column
    const description = place.ai_article?.story 
      ? place.ai_article.story.substring(0, 450).trim() + "..." 
      : "Explore this hidden gem in Sri Lanka.";
    
    return `
      <item>
        <title><![CDATA[${place.place_name}]]></title>
        <link>${escapedUrl}</link>
        <description><![CDATA[${description}]]></description>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <guid isPermaLink="false">my-journal-${place.id}</guid>
        <media:content url="${escapedMediaUrl}" medium="image" />
      </item>`;
  }).join('');

  // 3. Construct the Full RSS XML
  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <title>My Journal | Sri Lanka Exploration</title>
        <link>https://my-journal-viewer.vercel.app/</link>
        <description>Hidden waterfalls, mountain treks, and cinematic drone footage by Hasitha Gunasekera.</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`;

  // 4. Set Headers and Send
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(rssFeed);
}