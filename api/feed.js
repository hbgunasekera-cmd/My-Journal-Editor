// api/feed.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`id, place_name, created_at, cover_photo_url, ai_article`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  const rssItems = places.map(place => {
    const rawUrl = `https://my-journal-viewer.vercel.app/?place=${encodeURIComponent(place.place_name)}&utm_source=rss_feed`;
    const escapedUrl = rawUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
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

  // REFINED HEADERS FOR CRAWLERS
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); 
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8'); 
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.status(200).send(rssFeed.trim());
}