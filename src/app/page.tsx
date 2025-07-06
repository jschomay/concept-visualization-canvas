"use client";

import { useState, useEffect, useRef } from "react";
import { fal } from "@fal-ai/client";
import { saveImage, loadAllImages, updateImage, deleteImage, updateImagePosition, Image } from "../lib/images";
import { generateImageWithFal } from "../lib/imageGeneration";
import ImageTile from "../components/ImageTile";
import { CANVAS_HEIGHT, IMAGE_SIZE, TOP_GUTTER, BLANK_CANVAS_IMAGE, PLACEHOLDER_PROMPT } from "../constants/layout";
import { Grid, Trash2 } from "lucide-react";

// Extended image type with local state for race condition management
type LocalImage = Image & {
  isGenerating?: boolean;
  latestRequestTime?: number;
  latestResponseTime?: number;
};

fal.config({
  proxyUrl: "/api/fal/proxy",
});

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [imagesMap, setImagesMap] = useState<Map<string, LocalImage>>(new Map());
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadPreviousImages = async () => {
      try {
        const allImages = await loadAllImages();
        const newImagesMap = new Map<string, LocalImage>();
        allImages.forEach(image => {
          // Convert database Image to LocalImage
          const localImage: LocalImage = {
            ...image,
            isGenerating: false,
            latestRequestTime: 0,
            latestResponseTime: 0,
          };
          newImagesMap.set(image.id, localImage);
        });
        setImagesMap(newImagesMap);
        if (allImages.length > 0) {
          const latestImage = allImages[0];
          setPrompt(latestImage.prompt);
          setSelectedImageId(latestImage.id);
        } else {
          // Create placeholder if no saved images exist
          const placeholder = createPlaceholderImage();
          setImagesMap(prev => new Map(prev).set('temp-placeholder', placeholder));
          setSelectedImageId('temp-placeholder');
          setPrompt('');
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

  const createPlaceholderImage = (): LocalImage => {
    const centerX = window.innerWidth / 2 - IMAGE_SIZE / 2;
    const topY = TOP_GUTTER;

    return {
      id: 'temp-placeholder',
      prompt: PLACEHOLDER_PROMPT,
      image_url: BLANK_CANVAS_IMAGE,
      position_x: centerX,
      position_y: topY,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isGenerating: false,
      latestRequestTime: 0,
      latestResponseTime: 0,
    };
  };

  const selectNextImageAfterDelete = (deletedImageId: string) => {
    if (selectedImageId !== deletedImageId) return;

    const remainingImages = Array.from(imagesMap.values()).filter(img => img.id !== deletedImageId);
    if (remainingImages.length > 0) {
      const nextImage = remainingImages[0];
      setSelectedImageId(nextImage.id);
      setPrompt(nextImage.prompt);
    } else {
      // Create placeholder if no images remain
      const placeholder = createPlaceholderImage();
      setImagesMap(new Map([['temp-placeholder', placeholder]]));
      setSelectedImageId('temp-placeholder');
      setPrompt('');
    }
  };

  const getSmartClonePosition = (originalImage: LocalImage): { x: number, y: number } => {
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

  const calculateGridPositions = (images: LocalImage[]): { id: string, x: number, y: number }[] => {
    const padding = 20;
    const startX = padding;
    const startY = TOP_GUTTER;
    
    // Calculate how many images fit per row
    const availableWidth = window.innerWidth - (2 * padding);
    const imageWithPadding = IMAGE_SIZE + padding;
    const imagesPerRow = Math.floor(availableWidth / imageWithPadding);
    
    return images.map((image, index) => {
      const row = Math.floor(index / imagesPerRow);
      const col = index % imagesPerRow;
      
      return {
        id: image.id,
        x: startX + (col * imageWithPadding),
        y: startY + (row * imageWithPadding)
      };
    });
  };

  const getVariationPositions = (originalImage: LocalImage): { x: number, y: number }[] => {
    const imageWidth = IMAGE_SIZE;
    const spacing = 20;

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
      const tempClone: LocalImage = {
        id: tempId,
        prompt: imageToClone.prompt,
        image_url: imageToClone.image_url,
        position_x: clonePosition.x,
        position_y: clonePosition.y,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isGenerating: false,
        latestRequestTime: Date.now(),
        latestResponseTime: Date.now(),
      };

      setImagesMap(prev => new Map(prev).set(tempId, tempClone));
      setSelectedImageId(tempId);
      setPrompt(tempClone.prompt);

      // Save to database in background with position
      const clonedImage = await saveAndReplaceTempImage(
        tempId,
        imageToClone.prompt,
        imageToClone.image_url,
        clonePosition,
        true // shouldUpdateSelected
      );

      if (!clonedImage) {
        // Remove temp clone if save failed and reset selection
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

  const saveAndReplaceTempImage = async (
    tempId: string,
    prompt: string,
    imageUrl: string,
    position: { x: number, y: number },
    shouldUpdateSelected: boolean = false
  ) => {
    try {
      const savedImage = await saveImage(prompt, imageUrl, position.x, position.y);
      if (savedImage) {
        const currentTempImage = imagesMap.get(tempId);
        const realImage: LocalImage = {
          ...savedImage,
          isGenerating: false,
          latestRequestTime: currentTempImage?.latestRequestTime || Date.now(),
          latestResponseTime: currentTempImage?.latestResponseTime || Date.now(),
        };

        setImagesMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          newMap.set(savedImage.id, realImage);
          return newMap;
        });

        // Update selectedImageId if this was the selected temp
        if (shouldUpdateSelected && tempId === selectedImageId) {
          setSelectedImageId(savedImage.id);
        }

        return savedImage;
      }
    } catch (error) {
      console.error('Error saving and replacing temp image:', error);
      return null;
    }
    return null;
  };

  const generateImage = async (promptToGenerate: string) => {
    if (!selectedImageId) {
      console.error('❌ Unexpected: no selected image at generation start');
      return;
    }

    if (!promptToGenerate.trim()) return;

    const requestPrompt = promptToGenerate;
    const requestTime = Date.now();
    const targetImageId = selectedImageId;

    // Set loading state and request time for target image
    setImagesMap(prev => {
      const newMap = new Map(prev);
      const currentImage = newMap.get(targetImageId);
      if (currentImage) {
        newMap.set(targetImageId, {
          ...currentImage,
          isGenerating: true,
          latestRequestTime: requestTime,
        });
      }
      return newMap;
    });

    try {
      const newImageUrl = await generateImageWithFal(requestPrompt);

      if (newImageUrl) {
        // Update image with race condition logic
        setImagesMap(prev => {
          const newMap = new Map(prev);
          const currentImage = newMap.get(targetImageId);
          if (!currentImage) return prev;

          const currentResponseTime = currentImage.latestResponseTime || 0;

          // Only accept if this response is newer than current
          if (requestTime >= currentResponseTime) {
            newMap.set(targetImageId, {
              ...currentImage,
              image_url: newImageUrl,
              prompt: requestPrompt,
              latestResponseTime: requestTime,
              isGenerating: requestTime < (currentImage.latestRequestTime || 0),
              updated_at: new Date().toISOString(),
            });
          }
          return newMap;
        });

        // Handle database operations
        if (targetImageId.startsWith('temp-')) {
          // Save temp image to database and replace with real image
          const currentImage = imagesMap.get(targetImageId);
          if (currentImage) {
            setTimeout(() => {
              saveAndReplaceTempImage(
                targetImageId,
                requestPrompt,
                newImageUrl,
                { x: currentImage.position_x, y: currentImage.position_y },
                true // shouldUpdateSelected
              );
            }, 0);
          }
        } else {
          // Update existing database image in background
          updateImage(targetImageId, requestPrompt, newImageUrl).catch(error => {
            console.error('Error updating image in database:', error);
          });
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);

      // Clear loading state on error
      setImagesMap(prev => {
        const newMap = new Map(prev);
        const currentImage = newMap.get(targetImageId);
        if (currentImage && requestTime >= (currentImage.latestResponseTime || 0)) {
          if (targetImageId.startsWith('temp-')) {
            // Remove temp image on error
            newMap.delete(targetImageId);
          } else {
            // Just clear loading state for real images
            newMap.set(targetImageId, {
              ...currentImage,
              isGenerating: false,
            });
          }
        }
        return newMap;
      });
    }
  };

  const handleGenerateVariations = async (imageId: string) => {
    const originalImage = imagesMap.get(imageId);
    if (!originalImage) return;

    try {
      // 1. Create temp images immediately for instant feedback
      const positions = getVariationPositions(originalImage);
      const tempData = Array.from({ length: 4 }, (_, index) => {
        const position = positions[index];
        const tempId = `temp-${Date.now()}-${Math.random()}-${index}`;

        return {
          tempId,
          position,
          tempImage: {
            id: tempId,
            prompt: `Variation ${index + 1}...`, // Placeholder text
            image_url: '',
            position_x: position.x,
            position_y: position.y,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isGenerating: true, // Start in generating state
            latestRequestTime: 0,
            latestResponseTime: 0,
          } as LocalImage
        };
      });

      // 2. Create ALL temp images in ONE state update (instant UI feedback)
      setImagesMap(prev => {
        const newMap = new Map(prev);
        tempData.forEach(({ tempId, tempImage }) => {
          newMap.set(tempId, tempImage);
        });
        return newMap;
      });

      // 3. Get prompt variations from OpenAI
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

      // 4. Process each variation independently for streaming UX
      const variationPromises = tempData.map(async ({ tempId, position }, index) => {
        try {
          const variation = variations[index];
          if (!variation) return;

          // Update temp image with actual prompt
          setImagesMap(prev => {
            const newMap = new Map(prev);
            const tempImage = newMap.get(tempId);
            if (tempImage) {
              newMap.set(tempId, {
                ...tempImage,
                prompt: variation,
              });
            }
            return newMap;
          });

          // Generate image
          const imageUrl = await generateImageWithFal(variation);
          if (!imageUrl) return;

          // Update state immediately - show image right away  
          setImagesMap(prev => {
            const newMap = new Map(prev);
            const tempImage = newMap.get(tempId);
            if (tempImage) {
              newMap.set(tempId, {
                ...tempImage,
                image_url: imageUrl,
                isGenerating: false,
              });
            }
            return newMap;
          });

          // Save to database in background (user already sees image)
          await saveAndReplaceTempImage(
            tempId,
            variation,
            imageUrl,
            position,
            false // don't update selected - variations aren't selected
          );

        } catch (error) {
          console.error('Error processing variation:', error);
          // Remove failed temp image
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

  const handleArrangeGrid = async () => {
    const allImages = Array.from(imagesMap.values());
    const gridPositions = calculateGridPositions(allImages);
    
    // Update local state immediately for smooth UX
    setImagesMap(prev => {
      const newMap = new Map(prev);
      gridPositions.forEach(({ id, x, y }) => {
        const image = newMap.get(id);
        if (image) {
          newMap.set(id, { ...image, position_x: x, position_y: y });
        }
      });
      return newMap;
    });
    
    // Persist positions to database in background
    try {
      await Promise.all(
        gridPositions.map(async ({ id, x, y }) => {
          if (!id.startsWith('temp-')) {
            await updateImagePosition(id, x, y);
          }
        })
      );
    } catch (error) {
      console.error('Error persisting grid positions:', error);
    }
  };

  const handleClearAll = async () => {
    const allImages = Array.from(imagesMap.values());
    
    // Clear local state immediately for instant feedback
    setImagesMap(new Map());
    
    // Create placeholder and select it
    const placeholder = createPlaceholderImage();
    setImagesMap(new Map([['temp-placeholder', placeholder]]));
    setSelectedImageId('temp-placeholder');
    setPrompt('');
    
    // Delete all real images from database in background
    try {
      await Promise.all(
        allImages
          .filter(image => !image.id.startsWith('temp-')) // Only delete real images
          .map(image => deleteImage(image.id))
      );
    } catch (error) {
      console.error('Error clearing all images:', error);
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
      </div>

      {/* Action buttons - top right */}
      <div className="fixed top-8 right-8 z-50 flex gap-2">
        <button
          onClick={handleArrangeGrid}
          className="bg-white/90 backdrop-blur-sm hover:bg-gray-100 rounded-lg p-3 shadow-lg border border-gray-200 transition-all"
          title="Arrange images in grid"
        >
          <Grid size={20} />
        </button>
        
        <button
          onClick={handleClearAll}
          className="bg-white/90 backdrop-blur-sm hover:bg-red-500 hover:text-white rounded-lg p-3 shadow-lg border border-gray-200 transition-all"
          title="Clear all images"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Full canvas area */}
      <div className="relative w-full" style={{ height: `${CANVAS_HEIGHT}px` }}>
        {Array.from(imagesMap.values()).map(image => (
          <ImageTile
            key={image.id}
            image={image}
            isSelected={selectedImageId === image.id}
            isGenerating={!!image.isGenerating}
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
