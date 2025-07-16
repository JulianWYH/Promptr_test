import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const response = await fetch('https://api-inference.huggingface.co/models/haywoodsloan/ai-image-detector-deploy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'image/png', // Adjust if using a different format
      },
      body: buffer,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Hugging Face model error:', result);
      return NextResponse.json({ error: 'Failed to run AI detector model.' }, { status: 500 });
    }

    const label = result?.[0]?.label || 'unknown';
    const score = result?.[0]?.score ?? 0;

    return NextResponse.json({ result: `${(score * 100).toFixed(2)}% ${label}` });
  } catch (err) {
    console.error('AI detection route error:', err);
    return NextResponse.json({ error: 'AI detection failed' }, { status: 500 });
  }
}