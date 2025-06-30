"use client";

import { useState } from "react";
import { fal } from "@fal-ai/client";

fal.config({
  proxyUrl: "/api/fal/proxy",
});

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt,
          image_size: "square",
        },
        pollInterval: 500,
      });

      if (result.data.images && result.data.images[0]) {
        setImageUrl(result.data.images[0].url);
      }
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">AI Image Generator</h1>

        <div className="space-y-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && generateImage()}
            />
            <button
              onClick={generateImage}
              disabled={isGenerating || !prompt.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>

          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Generated image"
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
