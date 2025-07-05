import { IMAGE_SIZE } from "@/constants/layout";
import { fal } from "@fal-ai/client";

export async function generateImageWithFal(prompt: string): Promise<string | null> {
  try {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt: prompt,
        image_size: { width: IMAGE_SIZE, height: IMAGE_SIZE },
      },
      pollInterval: 200,
    });

    if (result.data.images && result.data.images[0]) {
      return result.data.images[0].url;
    }
    return null;
  } catch (error) {
    console.error('Error generating image with fal.ai:', error);
    return null;
  }
}
