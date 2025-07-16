import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const res = await fetch(imageUrl);
    const arrayBuffer = await res.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      { text: "Describe this image in a sentence of 10 words with no extravagant adjectives, taking note as well of the environment, characteristics, and expressions being done. For example: A polar bear standing on snow." },
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Image,
        },
      },
    ]);

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'No description';

    return NextResponse.json({ description: text });
  } catch (err) {
    console.error("Gemini describe error:", err);
    return NextResponse.json({ error: 'Image description failed' }, { status: 500 });
  }
}