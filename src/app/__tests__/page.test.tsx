import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { fal } from '@fal-ai/client'
import * as imagesLib from '../../lib/images'
import Home from '../page'

// Mock the images lib
jest.mock('../../lib/images', () => ({
  saveImage: jest.fn(),
  loadAllImages: jest.fn(),
  updateImage: jest.fn(),
}))

// Mock fal.ai client
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    subscribe: jest.fn(),
  },
}))

describe('Image Generation Logic', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    
    // Mock successful fal.ai response
    ;(fal.subscribe as jest.Mock).mockResolvedValue({
      data: {
        images: [{ url: 'https://example.com/generated-image.jpg' }]
      }
    })
  })

  describe('New image case (no existing image)', () => {
    beforeEach(() => {
      // Mock no existing images
      ;(imagesLib.loadAllImages as jest.Mock).mockResolvedValue([])
      ;(imagesLib.saveImage as jest.Mock).mockResolvedValue({
        id: 'new-image-id',
        prompt: 'test prompt',
        image_url: 'https://example.com/generated-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      })
    })

    it('should call saveImage when no selectedImageId exists', async () => {
      render(<Home />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Type a prompt (auto-generation happens after 500ms debounce)
      const input = screen.getByPlaceholderText('Type to generate an image...')
      
      fireEvent.change(input, { target: { value: 'test prompt' } })

      // Wait for debounced generation to complete
      await waitFor(() => {
        expect(imagesLib.saveImage).toHaveBeenCalledWith('test prompt', 'https://example.com/generated-image.jpg')
      }, { timeout: 1000 })

      // Verify updateImage was NOT called
      expect(imagesLib.updateImage).not.toHaveBeenCalled()
    })
  })

  describe('Existing image case (selectedImageId exists)', () => {
    beforeEach(() => {
      // Mock existing images array
      ;(imagesLib.loadAllImages as jest.Mock).mockResolvedValue([{
        id: 'existing-image-id',
        prompt: 'existing prompt',
        image_url: 'https://example.com/existing-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }])
      ;(imagesLib.updateImage as jest.Mock).mockResolvedValue({
        id: 'existing-image-id',
        prompt: 'updated prompt',
        image_url: 'https://example.com/generated-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:01Z',
      })
    })

    it('should call updateImage when selectedImageId exists', async () => {
      render(<Home />)
      
      // Wait for loading to complete and existing image to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify existing prompt is loaded
      await waitFor(() => {
        const input = screen.getByDisplayValue('existing prompt')
        expect(input).toBeInTheDocument()
      })

      // Change prompt (auto-generation happens after 500ms debounce)
      const input = screen.getByDisplayValue('existing prompt')
      
      fireEvent.change(input, { target: { value: 'updated prompt' } })

      // Wait for debounced generation to complete
      await waitFor(() => {
        expect(imagesLib.updateImage).toHaveBeenCalledWith(
          'existing-image-id', 
          'updated prompt', 
          'https://example.com/generated-image.jpg'
        )
      }, { timeout: 1000 })

      // Verify saveImage was NOT called
      expect(imagesLib.saveImage).not.toHaveBeenCalled()
    })
  })

  describe('Clone functionality', () => {
    beforeEach(() => {
      // Mock existing image to clone
      ;(imagesLib.loadAllImages as jest.Mock).mockResolvedValue([{
        id: 'original-image-id',
        prompt: 'original prompt',
        image_url: 'https://example.com/original-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }])
    })

    it('should clone image with correct data and auto-select it', async () => {
      // Mock the cloned image response
      ;(imagesLib.saveImage as jest.Mock).mockResolvedValue({
        id: 'cloned-image-id',
        prompt: 'original prompt', // Same prompt as original
        image_url: 'https://example.com/original-image.jpg', // Same URL
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:01Z',
        updated_at: '2023-01-01T00:00:01Z',
      })

      render(<Home />)
      
      // Wait for loading to complete and original image to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Find the clone button (should be hidden initially, visible on hover)
      const imageContainer = screen.getByRole('img').closest('div')
      expect(imageContainer).toBeInTheDocument()
      
      // Find and click the clone button
      const cloneButton = screen.getByTitle('Clone image')
      fireEvent.click(cloneButton)

      // Wait for clone operation to complete
      await waitFor(() => {
        expect(imagesLib.saveImage).toHaveBeenCalledWith(
          'original prompt',
          'https://example.com/original-image.jpg'
        )
      })

      // Verify the cloned image was "auto-selected" by checking the prompt input
      await waitFor(() => {
        const input = screen.getByDisplayValue('original prompt')
        expect(input).toBeInTheDocument()
      })
    })

    it('should handle clone errors gracefully', async () => {
      // Mock clone failure
      ;(imagesLib.saveImage as jest.Mock).mockRejectedValue(new Error('Database error'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<Home />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const cloneButton = screen.getByTitle('Clone image')
      fireEvent.click(cloneButton)

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error cloning image:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})