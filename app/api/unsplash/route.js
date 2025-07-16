import axios from 'axios';

export async function GET() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  const response = await axios.get('https://api.unsplash.com/photos/random', {
    params: {
      client_id: accessKey,
      count: 1,
      query: 'animals',
    },
  });

  const photo = response.data[0] || response.data;

  return new Response(
    JSON.stringify({
      url: photo.urls.small,
      alt_description: photo.alt_description || 'No description available',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
