"use client";

import { useState, useEffect, useRef } from "react";
import { fal } from "@fal-ai/client";
import { saveImage, loadAllImages, updateImage, deleteImage, updateImagePosition, Image } from "../lib/images";
import { generateImageWithFal } from "../lib/imageGeneration";
import ImageTile from "../components/ImageTile";
import { CANVAS_HEIGHT, IMAGE_SIZE } from "../constants/layout";

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

  const handlePositionChange = async (imageId: string, x: number, y: number) => {
    // Update local state immediately for smooth UX
    setImagesMap(prev => {
      const newMap = new Map(prev);
      const image = newMap.get(imageId);
      if (image) {
        newMap.set(imageId, { ...image, position_x: x, position_y: y });
      }
      return newMap;
    });

    // Then persist to database in background
    try {
      await updateImagePosition(imageId, x, y);
    } catch (error) {
      console.error('Error updating image position:', error);
      // Could add optimistic rollback here if needed
    }
  };

  const selectNextImageAfterDelete = (deletedImageId: string) => {
    if (selectedImageId !== deletedImageId) return;

    const remainingImages = Array.from(imagesMap.values()).filter(img => img.id !== deletedImageId);
    if (remainingImages.length > 0) {
      const nextImage = remainingImages[0];
      setSelectedImageId(nextImage.id);
      setPrompt(nextImage.prompt);
    } else {
      setSelectedImageId(null);
      setPrompt('');
    }
  };

  const getSmartClonePosition = (originalImage: Image): { x: number, y: number } => {
    const offsetX = 30;
    const offsetY = 30;
    const imageWidth = IMAGE_SIZE;
    const canvasWidth = window.innerWidth;
    const canvasHeight = CANVAS_HEIGHT;

    // Try to place to the right first
    let newX = originalImage.position_x + imageWidth + offsetX;
    let newY = originalImage.position_y;

    // If would go off right edge, try below
    if (newX + imageWidth > canvasWidth) {
      newX = originalImage.position_x;
      newY = originalImage.position_y + IMAGE_SIZE + offsetY; // Full image height + offset

      // If would go off bottom edge, place to the left
      if (newY + IMAGE_SIZE > canvasHeight) {
        newX = Math.max(0, originalImage.position_x - imageWidth - offsetX);
        newY = originalImage.position_y;
      }
    }

    return { x: newX, y: newY };
  };

  const getVariationPositions = (originalImage: Image): { x: number, y: number }[] => {
    const imageWidth = IMAGE_SIZE;
    const imageHeight = IMAGE_SIZE;
    const spacing = 20;
    const canvasHeight = CANVAS_HEIGHT;

    const positions: { x: number, y: number }[] = [];

    // Calculate space needed for 4 variations horizontally
    const totalWidth = 4 * imageWidth + 3 * spacing;
    const canvasWidth = window.innerWidth;

    // Check if we can place variations to the right of the original image
    const spaceToRight = canvasWidth - (originalImage.position_x + imageWidth);
    const placeToRight = spaceToRight >= totalWidth;

    if (placeToRight) {
      // Place variations to the right of the original image
      const startX = originalImage.position_x + imageWidth + spacing;
      for (let i = 0; i < 4; i++) {
        positions.push({
          x: startX + i * (imageWidth + spacing),
          y: originalImage.position_y
        });
      }
    } else {
      // Place variations to the left of the original image
      const startX = originalImage.position_x - spacing - totalWidth;
      for (let i = 0; i < 4; i++) {
        positions.push({
          x: Math.max(0, startX + i * (imageWidth + spacing)),
          y: originalImage.position_y
        });
      }
    }

    return positions;
  };

  const handleClone = async (imageId: string) => {
    const imageToClone = imagesMap.get(imageId);
    if (!imageToClone) return;

    try {
      const clonePosition = getSmartClonePosition(imageToClone);
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      // Update local state immediately for instant UX
      const tempClone = {
        id: tempId,
        prompt: imageToClone.prompt,
        image_url: imageToClone.image_url,
        position_x: clonePosition.x,
        position_y: clonePosition.y,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setImagesMap(prev => new Map(prev).set(tempId, tempClone));
      setSelectedImageId(tempId);
      setPrompt(tempClone.prompt);

      // Save to database in background with position
      const clonedImage = await saveImage(imageToClone.prompt, imageToClone.image_url, clonePosition.x, clonePosition.y);
      if (clonedImage) {
        // Replace temp with real image from database (already has correct position)
        setImagesMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId); // Remove temp
          newMap.set(clonedImage.id, clonedImage); // Add real
          return newMap;
        });
        setSelectedImageId(clonedImage.id);
      } else {
        // Remove temp clone if save failed
        setImagesMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        setSelectedImageId(null);
      }
    } catch (error) {
      console.error('Error cloning image:', error);
    }
  };

  const handleDelete = async (imageId: string) => {
    // Handle temporary images (not yet saved to database)
    if (imageId.startsWith('temp-')) {
      // Just remove from local state immediately
      setImagesMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(imageId);
        return newMap;
      });

      selectNextImageAfterDelete(imageId);
      return;
    }

    // Handle real database images
    try {
      const success = await deleteImage(imageId);
      if (success) {
        // Remove from local state
        setImagesMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(imageId);
          return newMap;
        });

        selectNextImageAfterDelete(imageId);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleGenerateVariations = async (imageId: string) => {
    const originalImage = imagesMap.get(imageId);
    if (!originalImage) return;

    try {
      // Get prompt variations from OpenAI
      const response = await fetch('/api/variations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: originalImage.prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate variations');
      }

      const { variations } = await response.json();

      if (!variations || variations.length === 0) {
        throw new Error('No variations generated');
      }

      // Get positions for the variations
      const positions = getVariationPositions(originalImage);

      // Generate images for each variation in parallel
      const variationPromises = variations.map(async (variation: string, index: number) => {
        const position = positions[index];
        const tempId = `temp-${Date.now()}-${Math.random()}-${index}`;

        // Create temporary image with loading state
        const tempImage = {
          id: tempId,
          prompt: variation,
          image_url: '', // Will be filled when generation completes
          position_x: position.x,
          position_y: position.y,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add to local state immediately
        setImagesMap(prev => new Map(prev).set(tempId, tempImage));

        try {
          // Generate image with fal.ai
          const imageUrl = await generateImageWithFal(variation);

          if (imageUrl) {
            // Save to database
            const savedImage = await saveImage(variation, imageUrl, position.x, position.y);

            if (savedImage) {
              // Replace temp with real image
              setImagesMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(tempId);
                newMap.set(savedImage.id, savedImage);
                return newMap;
              });
            } else {
              // Remove temp if save failed
              setImagesMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(tempId);
                return newMap;
              });
            }
          }
        } catch (error) {
          console.error('Error generating variation:', error);
          // Remove temp image on error
          setImagesMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(tempId);
            return newMap;
          });
        }
      });

      // Wait for all variations to complete
      await Promise.all(variationPromises);

    } catch (error) {
      console.error('Error generating variations:', error);
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
      const newImageUrl = await generateImageWithFal(requestPrompt);

      // Ignore stale responses
      if (currentPromptRef.current !== requestPrompt) {
        return;
      }

      if (newImageUrl) {

        if (requestSelectedImageId) {
          // Update the image that was selected when request started
          const updatedImage = await updateImage(requestSelectedImageId, requestPrompt, newImageUrl);
          if (updatedImage) {
            setImagesMap(prev => new Map(prev).set(updatedImage.id, updatedImage));
          }
        } else {
          // Create new image in center (only happens when no images exist)
          const centerX = window.innerWidth / 2 - IMAGE_SIZE / 2; // Center of screen - half image width
          const centerY = CANVAS_HEIGHT / 2; // Center of canvas height
          const tempId = `temp-${Date.now()}-${Math.random()}`;

          // Update local state immediately for instant UX
          const tempImage = {
            id: tempId,
            prompt: requestPrompt,
            image_url: newImageUrl,
            position_x: centerX,
            position_y: centerY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setImagesMap(prev => new Map(prev).set(tempId, tempImage));
          setSelectedImageId(tempId);

          // Save to database in background with position
          const newImage = await saveImage(requestPrompt, newImageUrl, centerX, centerY);
          if (newImage) {
            // Replace temp with real image from database (already has correct position)
            setImagesMap(prev => {
              const newMap = new Map(prev);
              newMap.delete(tempId); // Remove temp
              newMap.set(newImage.id, newImage); // Add real
              return newMap;
            });
            setSelectedImageId(newImage.id);
          } else {
            // Remove temp image if save failed
            setImagesMap(prev => {
              const newMap = new Map(prev);
              newMap.delete(tempId);
              return newMap;
            });
            setSelectedImageId(null);
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
    <div className="w-screen h-screen overflow-auto bg-gray-50 relative">
      {/* Floating input at top */}
      <div className="w-1/2 fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="px-4 py-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
          <input
            type="text"
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Type to generate an image..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isGenerating && (
          <div className="text-sm text-gray-500 text-center mt-2">Generating...</div>
        )}
      </div>

      {/* Full canvas area */}
      <div className="relative w-full" style={{ height: `${CANVAS_HEIGHT}px` }}>
        {Array.from(imagesMap.values()).map(image => (
          <ImageTile
            key={image.id}
            image={image}
            isSelected={selectedImageId === image.id}
            onSelect={handleImageSelect}
            onClone={handleClone}
            onDelete={handleDelete}
            onPositionChange={handlePositionChange}
            onGenerateVariations={handleGenerateVariations}
          />
        ))}
      </div>
    </div>
  );
}
