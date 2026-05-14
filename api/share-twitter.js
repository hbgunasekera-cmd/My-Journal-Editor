import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  // 1. Method Validation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { text, link } = req.body;

  // 2. Credential Initialization
  // Ensure these are set in your Vercel Project Environment Variables
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,         
    appSecret: process.env.TWITTER_API_SECRET,   
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    // 3. Status Construction
    // Standardizing the format to match your Mastodon/Meta posts
    const fullStatus = `${text}\n\n 🔗 Web: ${link}\n\n#MyJournal #SriLanka #Travel`;

    // 4. Execute Post
    // Using the v2 API specifically for posting "tweets"
    const { data } = await client.v2.tweet(fullStatus);

    return res.status(200).json({ 
      success: true, 
      tweetId: data.id 
    });

  } catch (error) {
    console.error("Twitter Push Error:", error);
    
    // Handle specific Twitter API error messages
    const errorMessage = error.data?.detail || error.message || "Unknown Twitter API Error";
    
    return res.status(500).json({ 
      error: errorMessage 
    });
  }
}