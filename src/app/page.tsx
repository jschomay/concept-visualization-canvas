"use client";

import { useState, useEffect, useRef } from "react";
import { fal } from "@fal-ai/client";
import { saveImage, loadAllImages, updateImage, Image } from "../lib/images";
import ImageTile from "../components/ImageTile";

fal.config({
  proxyUrl: "/api/fal/proxy",
});

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [imagesMap, setImagesMap] = useState<Map<string, Image>>(new Map());
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const currentPromptRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadPreviousImages = async () => {
      try {
        const allImages = await loadAllImages();
        const newImagesMap = new Map<string, Image>();
        allImages.forEach(image => newImagesMap.set(image.id, image));
        setImagesMap(newImagesMap);
        if (allImages.length > 0) {
          const latestImage = allImages[0];
          setPrompt(latestImage.prompt);
          setSelectedImageId(latestImage.id);
        }
      } catch (error) {
        console.error("Error loading previous images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreviousImages();
  }, []);

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Don't generate for empty prompts
    if (!newPrompt.trim()) {
      setIsGenerating(false);
      return;
    }
    
    // Set new timeout for generation
    timeoutRef.current = setTimeout(() => {
      generateImage(newPrompt);
    }, 500);
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImageId(imageId);
    const selectedImage = imagesMap.get(imageId);
    if (selectedImage) {
      setPrompt(selectedImage.prompt);
    }
  };

  const handleClone = async (imageId: string) => {
    const imageToClone = imagesMap.get(imageId);
    if (!imageToClone) return;

    try {
      // Save clone to database immediately to get persisted ID
      const clonedImage = await saveImage(imageToClone.prompt, imageToClone.image_url);
      if (clonedImage) {
        // Add to local state with real DB ID
        setImagesMap(prev => new Map(prev).set(clonedImage.id, clonedImage));
        // Auto-select the newly cloned image
        setSelectedImageId(clonedImage.id);
        setPrompt(clonedImage.prompt);
      }
    } catch (error) {
      console.error('Error cloning image:', error);
    }
  };

  const generateImage = async (promptToGenerate: string) => {
    if (!promptToGenerate.trim()) return;

    // Track which prompt and image this request is for
    currentPromptRef.current = promptToGenerate;
    const requestPrompt = promptToGenerate;
    const requestSelectedImageId = selectedImageId;

    setIsGenerating(true);
    try {
      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: requestPrompt,
          image_size: "square",
        },
        pollInterval: 500,
      });

      // Ignore stale responses
      if (currentPromptRef.current !== requestPrompt) {
        return;
      }

      if (result.data.images && result.data.images[0]) {
        const newImageUrl = result.data.images[0].url;

        if (requestSelectedImageId) {
          // Update the image that was selected when request started
          const updatedImage = await updateImage(requestSelectedImageId, requestPrompt, newImageUrl);
          if (updatedImage) {
            setImagesMap(prev => new Map(prev).set(updatedImage.id, updatedImage));
          }
        } else {
          // Create new image
          const newImage = await saveImage(requestPrompt, newImageUrl);
          if (newImage) {
            setImagesMap(prev => new Map(prev).set(newImage.id, newImage));
            setSelectedImageId(newImage.id);
          }
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      // Only clear loading if this is still the current request
      if (currentPromptRef.current === requestPrompt) {
        setIsGenerating(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">AI Image Generator</h1>

        <div className="space-y-6">
          <div className="space-y-2">
            <input
              type="text"
              value={prompt}
              onChange={handlePromptChange}
              placeholder="Type to generate an image..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isGenerating && (
              <div className="text-sm text-gray-500 text-center">Generating...</div>
            )}
          </div>

          {imagesMap.size > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from(imagesMap.values()).map(image => (
                <ImageTile
                  key={image.id}
                  image={image}
                  isSelected={selectedImageId === image.id}
                  onSelect={handleImageSelect}
                  onClone={handleClone}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
