import { NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';

export async function POST(req) {
  const body = await req.json();
  const { prompt } = body;

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  try {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Initialize with API key from environment
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const fullPrompt = `${prompt}. Make the image realistic, 720p quality. Describe this image in a sentence of 10 words with no extravagant adjectives, taking note as well of the environment, characteristics, and expressions being done. For example: A polar bear standing on snow. Strictly output only your description and image, no other text`;

    // Use the image generation model with both text and image output
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: fullPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates[0].content.parts;
    const result = {};

    // Process both text and image parts
    for (const part of parts) {
      if (part.text) {
        result.text = part.text;
        result.description = part.text;
      }
      if (part.inlineData) {
        result.imageBase64 = part.inlineData.data;
        result.mimeType = part.inlineData.mimeType;
      }
    }

    return NextResponse.json(result);

  } catch (err) {
    console.error('Gemini API error:', err);
    return NextResponse.json({ 
      error: 'Image generation failed',
      details: err.message 
    }, { status: 500 });
  }
}