import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const response = await fetch('https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector', {
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

    const labelRaw = result?.[0]?.label || 'unknown';
    const scoreRaw = result?.[0]?.score ?? 0;

    let label;
    if (labelRaw.toLowerCase() === 'human') {
      label = 'realistic';
    } else if (labelRaw.toLowerCase() === 'artificial') {
      label = 'artificially generated';
    } else {
      label = 'unknown';
    }

    const score = `${(scoreRaw * 100).toFixed(2)}%`;

    return NextResponse.json({ result: `${score} ${label}` });
  } catch (err) {
    console.error('umm-maybe route error:', err);
    return NextResponse.json({ error: 'AI detection failed' }, { status: 500 });
  }
}