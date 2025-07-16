"use client";

import "../css/page.css";
import { useState, useEffect } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [similarity, setSimilarity] = useState(null);
  const [promptSimilarity, setPromptSimilarity] = useState(null);
  const [aiDetectionResult, setAiDetectionResult] = useState('');
  const [showAiAlert, setShowAiAlert] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState('');
  const [finalScore, setFinalScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageURL, setImageUrl] = useState(null);
  const [UnSLoading, setUnSLoading] = useState(true);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const res = await fetch('/api/unsplash');
        const data = await res.json();
        setImageUrl(data.url);
      } catch (error) {
        console.error("Failed to fetch image:", error);
        setError("Failed to load Unsplash image.");
      } finally {
        setUnSLoading(false);
      }
    };

    fetchImage();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setImage(null);
    setDescription('');
    setGeneratedDescription('');
    setSimilarity(null);
    setPromptSimilarity(null);
    setAiDetectionResult('');
    setShowAiAlert(false);
    setQualityAnalysis('');
    setFinalScore(null);
    setError('');

    try {
      // Step 1: Generate Gemini image from prompt
      const genRes = await fetch('/api/geminigenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Gemini image generation failed.');

      setImage(genData.imageBase64);
      setDescription(genData.text);

      // Step 2: Describe the Unsplash image
      const describeRes = await fetch('/api/geminidescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageURL }),
      });

      const describeData = await describeRes.json();
      if (!describeRes.ok) throw new Error(describeData.error || 'Failed to describe Unsplash image.');

      setGeneratedDescription(describeData.description);
      await new Promise(resolve => setTimeout(resolve, 5000)); 

      // Step 3: AI Detection using umm-maybe
      const aiDetectRes = await fetch('/api/aidetector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: genData.imageBase64 }),
      });

      const aiDetectData = await aiDetectRes.json();
      if (!aiDetectRes.ok) throw new Error(aiDetectData.error || 'AI detection failed.');

      setAiDetectionResult(aiDetectData.result);

      if (aiDetectData.result.toLowerCase().includes("artificially generated")) {
        setShowAiAlert(true);
        setLoading(false);
        return;
      }

      // Step 4: Quality analysis via Gemini
      const analyzeRes = await fetch('/api/geminianalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: `data:image/png;base64,${genData.imageBase64}` }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Image quality analysis failed.');

      setQualityAnalysis(analyzeData.analysis);

      // Step 5: Compare Gemini and Unsplash descriptions
      const simRes = await fetch('/api/minilm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text1: describeData.description,
          text2: genData.text,
        }),
      });

      const simData = await simRes.json();
      if (!simRes.ok) throw new Error(simData.error || 'Similarity comparison failed.');

      setSimilarity(simData.score);

      // Step 6: Compare input prompt with Unsplash description
      const promptCompareRes = await fetch('/api/minilm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text1: prompt,
          text2: describeData.description,
        }),
      });

      const promptCompareData = await promptCompareRes.json();
      if (!promptCompareRes.ok) throw new Error(promptCompareData.error || 'Prompt-Unsplash similarity comparison failed.');

      setPromptSimilarity(promptCompareData.score);

      // Final score calculation
      if (
        typeof simData.score === 'number' &&
        typeof promptCompareData.score === 'number'
      ) {
        const average =
          ((simData.score * 100) + (promptCompareData.score * 100)) / 2;
        setFinalScore(average);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Unexpected error.');
    }

    setLoading(false);
  };

  return (
    <div className="page">
      <main className="main">
        <div className="generator">
          {UnSLoading ? (
            <p>Loading image...</p>
          ) : imageURL ? (
            <>
              <img src={imageURL} alt="Unsplash Image" />
              {generatedDescription && (
                <p className="generated-description">{generatedDescription}</p>
              )}
            </>
          ) : (
            <p>Could not load image.</p>
          )}

          <div className="imageGenerate">
            <input
              type="text"
              placeholder="Enter your prompt here"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input"
            />

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || UnSLoading}
              className="button"
            >
              Generate Image
            </button>
          </div>

          {showAiAlert && (
            <div className="alert">
              <p>The generated image looks too unrealistic, please improve your prompt.</p>
              <button onClick={() => setShowAiAlert(false)} className="close-alert">
                Close
              </button>
            </div>
          )}

          {loading && <p>Generating image...</p>}

          {image && !showAiAlert && (
            <div className="imagePreview">
              <img src={`data:image/png;base64,${image}`} alt="Generated" />
              {description && <p>{description}</p>}
              {aiDetectionResult && (
                <p>AI Detection Result: {aiDetectionResult}</p>
              )}
              {qualityAnalysis && (
                <p>Gemini Analysis: {qualityAnalysis}</p>
              )}
              {similarity !== null && (
                <p>Image Similarity: {(similarity * 100).toFixed(2)}%</p>
              )}
              {promptSimilarity !== null && (
                <p>Prompt Grade: {(promptSimilarity * 100).toFixed(2)}%</p>
              )}
              {finalScore !== null && (
                <p><strong>Final Score:</strong> {finalScore.toFixed(2)}%</p>
              )}
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </main>
    </div>
  );
}