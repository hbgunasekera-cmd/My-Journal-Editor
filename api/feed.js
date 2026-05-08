// api/feed.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  // Fetch latest 20 locations from Supabase
  const { data: places, error } = await supabase
    .from('locations') // Ensure this matches your table name
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  // Construct the RSS XML
  const rssItems = places.map(place => {
    const shareUrl = `https://my-journal-viewer.vercel.app/?place=${encodeURIComponent(place.place_name)}`;
    const description = place.story ? place.story.substring(0, 500) : "Explore this hidden gem in Sri Lanka.";
    
    return `
      <item>
        <title>${place.place_name}</title>
        <link>${shareUrl}</link>
        <description>${description}</description>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <guid>${shareUrl}</guid>
        <media:content url="${place.cover_photo_url}" medium="image" />
      </item>`;
  }).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>My Journal | Sri Lanka Exploration</title>
        <link>https://my-journal-viewer.vercel.app/</link>
        <description>Hidden waterfalls, mountain treks, and cinematic drone footage by Hasitha Gunasekera.</description>
        ${rssItems}
      </channel>
    </rss>`;

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(rssFeed);
}