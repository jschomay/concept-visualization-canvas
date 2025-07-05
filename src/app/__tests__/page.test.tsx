import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { fal } from '@fal-ai/client'
import * as imagesLib from '../../lib/images'
import { CANVAS_HEIGHT, IMAGE_SIZE } from '../../constants/layout'
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

describe('Image Generation Logic', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    
    // Mock window.innerWidth for consistent test results
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    
    // Mock successful fal.ai response
    ;(fal.subscribe as jest.Mock).mockResolvedValue({
      data: {
        images: [{ url: 'https://example.com/generated-image.jpg' }]
      }
    })
    
    // Mock successful position updates
    ;(imagesLib.updateImagePosition as jest.Mock).mockResolvedValue(true)
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
        expect(imagesLib.saveImage).toHaveBeenCalledWith(
          'test prompt', 
          'https://example.com/generated-image.jpg', 
          1024/2 - IMAGE_SIZE/2, // Center X: window width / 2 - half image width
          CANVAS_HEIGHT/2         // Center Y: canvas height / 2
        )
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
          'https://example.com/original-image.jpg',
          IMAGE_SIZE + 30, // Smart clone position: image width + 30px offset (to the right)
          0                // Same Y position as original
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
        expect(consoleSpy).toHaveBeenCalledWith('Error saving and replacing temp image:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Delete functionality', () => {
    beforeEach(() => {
      // Mock existing images array with multiple images
      ;(imagesLib.loadAllImages as jest.Mock).mockResolvedValue([
        {
          id: 'image-1',
          prompt: 'first image',
          image_url: 'https://example.com/image-1.jpg',
          position_x: 0,
          position_y: 0,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'image-2',
          prompt: 'second image',
          image_url: 'https://example.com/image-2.jpg',
          position_x: 0,
          position_y: 0,
          created_at: '2023-01-01T00:00:01Z',
          updated_at: '2023-01-01T00:00:01Z',
        }
      ])
    })

    it('should delete image and remove from UI', async () => {
      // Mock successful delete
      ;(imagesLib.deleteImage as jest.Mock).mockResolvedValue(true)

      render(<Home />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify both images are loaded
      await waitFor(() => {
        expect(screen.getByAltText('first image')).toBeInTheDocument()
        expect(screen.getByAltText('second image')).toBeInTheDocument()
      })

      // Find and click delete button on first image
      const deleteButtons = screen.getAllByTitle('Delete image')
      fireEvent.click(deleteButtons[0])

      // Wait for delete to complete
      await waitFor(() => {
        expect(imagesLib.deleteImage).toHaveBeenCalledWith('image-1')
      })

      // Verify first image is removed from UI
      await waitFor(() => {
        expect(screen.queryByAltText('first image')).not.toBeInTheDocument()
        expect(screen.getByAltText('second image')).toBeInTheDocument()
      })
    })

    it('should handle deleting selected image by selecting another', async () => {
      // Mock successful delete
      ;(imagesLib.deleteImage as jest.Mock).mockResolvedValue(true)

      render(<Home />)
      
      // Wait for loading to complete (first image auto-selected)
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify first image is selected (prompt in input)
      await waitFor(() => {
        const input = screen.getByDisplayValue('first image')
        expect(input).toBeInTheDocument()
      })

      // Delete the selected image
      const deleteButtons = screen.getAllByTitle('Delete image')
      fireEvent.click(deleteButtons[0])

      // Wait for delete and selection update
      await waitFor(() => {
        expect(imagesLib.deleteImage).toHaveBeenCalledWith('image-1')
      })

      // Verify second image becomes selected
      await waitFor(() => {
        const input = screen.getByDisplayValue('second image')
        expect(input).toBeInTheDocument()
      })
    })

    it('should clear prompt when deleting last image', async () => {
      // Mock only one image
      ;(imagesLib.loadAllImages as jest.Mock).mockResolvedValue([{
        id: 'only-image',
        prompt: 'only image',
        image_url: 'https://example.com/only-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }])
      
      // Mock successful delete
      ;(imagesLib.deleteImage as jest.Mock).mockResolvedValue(true)

      render(<Home />)
      
      // Wait for loading and verify image is selected
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
        const input = screen.getByDisplayValue('only image')
        expect(input).toBeInTheDocument()
      })

      // Delete the only image
      const deleteButton = screen.getByTitle('Delete image')
      fireEvent.click(deleteButton)

      // Wait for delete to complete
      await waitFor(() => {
        expect(imagesLib.deleteImage).toHaveBeenCalledWith('only-image')
      })

      // Verify prompt is cleared and no images shown
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Type to generate an image...')
        expect(input).toHaveValue('')
        expect(screen.queryByAltText('only image')).not.toBeInTheDocument()
      })
    })

    it('should handle delete errors gracefully', async () => {
      // Mock delete failure
      ;(imagesLib.deleteImage as jest.Mock).mockRejectedValue(new Error('Database error'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<Home />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete image')
      fireEvent.click(deleteButtons[0])

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error deleting image:', expect.any(Error))
      })

      // Verify images are still present (delete failed)
      expect(screen.getByAltText('first image')).toBeInTheDocument()
      expect(screen.getByAltText('second image')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should handle delete when database returns false', async () => {
      // Mock delete returning false (failed but no exception)
      ;(imagesLib.deleteImage as jest.Mock).mockResolvedValue(false)

      render(<Home />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete image')
      fireEvent.click(deleteButtons[0])

      // Wait for delete attempt
      await waitFor(() => {
        expect(imagesLib.deleteImage).toHaveBeenCalledWith('image-1')
      })

      // Verify images are still present (delete failed)
      expect(screen.getByAltText('first image')).toBeInTheDocument()
      expect(screen.getByAltText('second image')).toBeInTheDocument()
    })
  })
})