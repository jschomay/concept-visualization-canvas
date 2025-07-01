import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { fal } from '@fal-ai/client'
import * as imagesLib from '../../lib/images'
import Home from '../page'

// Mock the images lib
jest.mock('../../lib/images', () => ({
  saveImage: jest.fn(),
  loadLatestImage: jest.fn(),
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
      // Mock no existing image
      ;(imagesLib.loadLatestImage as jest.Mock).mockResolvedValue(null)
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

      // Type a prompt and generate
      const input = screen.getByPlaceholderText('Enter your prompt...')
      const generateButton = screen.getByText('Generate')
      
      fireEvent.change(input, { target: { value: 'test prompt' } })
      fireEvent.click(generateButton)

      // Wait for generation to complete
      await waitFor(() => {
        expect(imagesLib.saveImage).toHaveBeenCalledWith('test prompt', 'https://example.com/generated-image.jpg')
      })

      // Verify updateImage was NOT called
      expect(imagesLib.updateImage).not.toHaveBeenCalled()
    })
  })

  describe('Existing image case (selectedImageId exists)', () => {
    beforeEach(() => {
      // Mock existing image
      ;(imagesLib.loadLatestImage as jest.Mock).mockResolvedValue({
        id: 'existing-image-id',
        prompt: 'existing prompt',
        image_url: 'https://example.com/existing-image.jpg',
        position_x: 0,
        position_y: 0,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      })
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

      // Change prompt and generate
      const input = screen.getByDisplayValue('existing prompt')
      const generateButton = screen.getByText('Generate')
      
      fireEvent.change(input, { target: { value: 'updated prompt' } })
      fireEvent.click(generateButton)

      // Wait for generation to complete
      await waitFor(() => {
        expect(imagesLib.updateImage).toHaveBeenCalledWith(
          'existing-image-id', 
          'updated prompt', 
          'https://example.com/generated-image.jpg'
        )
      })

      // Verify saveImage was NOT called
      expect(imagesLib.saveImage).not.toHaveBeenCalled()
    })
  })
})