import { NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';

export async function POST(req) {
  const body = await req.json();
  const { prompt } = body;

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: `${prompt}. Make the image realistic, 720p quality. Describe this image in a sentence of 10 words with no extravagant adjectives, taking note as well of the environment, characteristics, and expressions being done. For example: A polar bear standing on snow. Strictly output only your description and image, no other text`,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates[0].content.parts;
    const result = {};

    for (const part of parts) {
      if (part.text) result.text = part.text;
      if (part.inlineData) result.imageBase64 = part.inlineData.data;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}