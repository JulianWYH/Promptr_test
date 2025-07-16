import { HfInference } from '@huggingface/inference';
import { NextResponse } from 'next/server';

const hf = new HfInference(process.env.HF_API_KEY);

export async function POST(req) {
  try {
    const { text1, text2 } = await req.json();

    if (!text1 || !text2) {
      return NextResponse.json({ error: 'Both text1 and text2 are required.' }, { status: 400 });
    }

    const result = await hf.sentenceSimilarity({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: {
        source_sentence: text1,
        sentences: [text2],
      },
    });

    const score = result?.[0];

    if (typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid similarity result.' }, { status: 500 });
    }

    return NextResponse.json({ score });
  } catch (error) {
    console.error('MiniLM route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}