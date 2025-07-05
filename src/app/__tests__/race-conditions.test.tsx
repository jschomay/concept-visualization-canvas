import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { fal } from '@fal-ai/client'
import * as imagesLib from '../../lib/images'
import * as imageGeneration from '../../lib/imageGeneration'
import Home from '../page'

// Mock the images lib
jest.mock('../../lib/images', () => ({
  saveImage: jest.fn(),
  loadAllImages: jest.fn(),
  updateImage: jest.fn(),
  deleteImage: jest.fn(),
  updateImagePosition: jest.fn(),
}))

// Mock fal.ai client
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    subscribe: jest.fn(),
  },
}))

// Mock the image generation lib
jest.mock('../../lib/imageGeneration', () => ({
  generateImageWithFal: jest.fn(),
}))

// Mock window.innerWidth for positioning calculations
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

describe('Race Condition Management (Approach B)', () => {
  const mockGenerateImageWithFal = imageGeneration.generateImageWithFal as jest.MockedFunction<typeof imageGeneration.generateImageWithFal>

  beforeEach(() => {
    jest.clearAllMocks()

      // Mock empty initial load
      ; (imagesLib.loadAllImages as jest.Mock).mockResolvedValue([])

      // Mock successful saves
      ; (imagesLib.saveImage as jest.Mock).mockImplementation((prompt, url, x, y) =>
        Promise.resolve({
          id: `real-${Date.now()}`,
          prompt,
          image_url: url,
          position_x: x,
          position_y: y,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      )

      ; (imagesLib.updateImage as jest.Mock).mockImplementation((id, prompt, url) =>
        Promise.resolve({
          id,
          prompt,
          image_url: url,
          position_x: 0,
          position_y: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      )
  })

  describe('Fast Typing Scenario - with out of order generation', () => {
    it('should show progressive updates and end with latest prompt', async () => {
      // Setup controllable promises
      let catResolver: (url: string) => void
      let birdResolver: (url: string) => void
      let fishResolver: (url: string) => void

      mockGenerateImageWithFal
        .mockImplementationOnce(() => new Promise(resolve => { catResolver = resolve }))
        .mockImplementationOnce(() => new Promise(resolve => { birdResolver = resolve }))
        .mockImplementationOnce(() => new Promise(resolve => { fishResolver = resolve }))

      render(<Home />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Type to generate an image...')

      // Fast typing sequence
      fireEvent.change(input, { target: { value: 'cat' } })
      await new Promise(resolve => setTimeout(resolve, 600)) // Wait for debounce

      fireEvent.change(input, { target: { value: 'bird' } })
      await new Promise(resolve => setTimeout(resolve, 600)) // Wait for debounce

      fireEvent.change(input, { target: { value: 'fish' } })
      await new Promise(resolve => setTimeout(resolve, 600)) // Wait for debounce

      // All three generations should be started
      expect(mockGenerateImageWithFal).toHaveBeenCalledTimes(3)

      // T=300: "cat" completes first
      await act(async () => {
        catResolver('cat-image-url')
      })

      // Should show cat image (progressive update)
      await waitFor(() => {
        const img = screen.getByAltText('cat')
        expect(img).toBeInTheDocument()
        expect(img.src).toContain('cat-image-url')
      })

      // T=400: "fish" completes (latest request)
      await act(async () => {
        fishResolver('fish-image-url')
      })

      // Should show fish image (final correct state)
      await waitFor(() => {
        const img = screen.getByAltText('fish')
        expect(img).toBeInTheDocument()
        expect(img.src).toContain('fish-image-url')
      })

      // T=500: "bird" completes (but should be ignored)
      await act(async () => {
        birdResolver('bird-image-url')
      })

      // Should still show fish (bird should be ignored as stale)
      await waitFor(() => {
        const img = screen.getByAltText('fish')
        expect(img).toBeInTheDocument()
        expect(img.src).toContain('fish-image-url')
      })

      // No bird image should be visible
      expect(screen.queryByAltText('bird')).not.toBeInTheDocument()
    })
  })


  describe('Multi-Image Race Conditions', () => {
    it('should handle independent generation timelines per image', async () => {
      // Setup existing images first
      const existingImages = [
        {
          id: 'image1',
          prompt: 'old-cat',
          image_url: 'old-cat-url',
          position_x: 0,
          position_y: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'image2',
          prompt: 'old-dog',
          image_url: 'old-dog-url',
          position_x: 250,
          position_y: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]

        ; (imagesLib.loadAllImages as jest.Mock).mockResolvedValue(existingImages)

      // Setup controllable promises for each image's generation
      let image1Resolver: (url: string) => void
      let image2Resolver: (url: string) => void

      mockGenerateImageWithFal
        .mockImplementationOnce(() => new Promise(resolve => { image1Resolver = resolve }))
        .mockImplementationOnce(() => new Promise(resolve => { image2Resolver = resolve }))

      render(<Home />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Should load both existing images
      await waitFor(() => {
        expect(screen.getByAltText('old-cat')).toBeInTheDocument()
        expect(screen.getByAltText('old-dog')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Type to generate an image...')

      // T=0: Select image1 and change prompt
      fireEvent.click(screen.getByAltText('old-cat'))
      fireEvent.change(input, { target: { value: 'new-bird' } })
      await new Promise(resolve => setTimeout(resolve, 600))

      // T=100: Select image2 and change prompt  
      fireEvent.click(screen.getByAltText('old-dog'))
      fireEvent.change(input, { target: { value: 'new-fish' } })
      await new Promise(resolve => setTimeout(resolve, 600))

      // Both generations should be started
      expect(mockGenerateImageWithFal).toHaveBeenCalledTimes(2)

      // T=300: Image1 generation completes
      await act(async () => {
        image1Resolver('new-bird-url')
      })

      // Image1 should update to new-bird
      await waitFor(() => {
        const img = screen.getByAltText('new-bird')
        expect(img).toBeInTheDocument()
        expect(img.src).toContain('new-bird-url')
      })

      // Image2 should still show old-dog (unchanged)
      expect(screen.getByAltText('old-dog')).toBeInTheDocument()

      // T=500: Image2 generation completes
      await act(async () => {
        image2Resolver('new-fish-url')
      })

      // Image2 should update to new-fish
      await waitFor(() => {
        const img = screen.getByAltText('new-fish')
        expect(img).toBeInTheDocument()
        expect(img.src).toContain('new-fish-url')
      })

      // Both images should be updated correctly
      expect(screen.getByAltText('new-bird')).toBeInTheDocument()
      expect(screen.getByAltText('new-fish')).toBeInTheDocument()

      // Old images should be gone
      expect(screen.queryByAltText('old-cat')).not.toBeInTheDocument()
      expect(screen.queryByAltText('old-dog')).not.toBeInTheDocument()
    })
  })
})
