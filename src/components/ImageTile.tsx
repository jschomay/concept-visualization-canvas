import { Image } from '../lib/images'
import { Copy, Trash2, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { CANVAS_HEIGHT, IMAGE_SIZE } from '../constants/layout'

interface ImageTileProps {
  image: Image
  isSelected: boolean
  isGenerating: boolean
  onSelect: (imageId: string) => void
  onClone: (imageId: string) => void
  onDelete: (imageId: string) => void
  onPositionChange: (imageId: string, x: number, y: number) => void
  onGenerateVariations: (imageId: string) => void
}

export default function ImageTile({ image, isSelected, isGenerating, onSelect, onClone, onDelete, onPositionChange, onGenerateVariations }: ImageTileProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 })

  // Reset image loaded state when URL changes
  useEffect(() => {
    setIsImageLoaded(false)
  }, [image.image_url])

  const handleImageLoad = () => {
    setIsImageLoaded(true)
  }

  const handleCloneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClone(image.id)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(image.id)
  }

  const handleVariationsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onGenerateVariations(image.id)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      // Don't start drag if clicking on buttons
      return
    }

    // Don't start drag if this is a temp image
    if (image.id.startsWith('temp-')) {
      return
    }

    e.preventDefault()
    setIsDragging(true)

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: image.position_x,
      initialY: image.position_y
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    const maxX = window.innerWidth - IMAGE_SIZE // Screen width - image width
    const maxY = CANVAS_HEIGHT - IMAGE_SIZE // Canvas height - image height

    const newX = Math.max(0, Math.min(maxX, dragRef.current.initialX + deltaX))
    const newY = Math.max(0, Math.min(maxY, dragRef.current.initialY + deltaY))

    setDragOffset({ x: newX - image.position_x, y: newY - image.position_y })
  }, [isDragging, image.position_x, image.position_y])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return

    setIsDragging(false)

    const newX = image.position_x + dragOffset.x
    const newY = image.position_y + dragOffset.y

    // Persist the new position
    onPositionChange(image.id, newX, newY)
    setDragOffset({ x: 0, y: 0 })
  }, [isDragging, image.position_x, image.position_y, image.id, dragOffset.x, dragOffset.y, onPositionChange])

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const currentX = image.position_x + dragOffset.x
  const currentY = image.position_y + dragOffset.y

  return (
    <div
      className={`absolute group hover:z-50 ${isDragging ? 'z-50' : isSelected ? 'z-40' : ''}`}
      style={{
        left: `${currentX}px`,
        top: `${currentY}px`,
        width: `${IMAGE_SIZE}px`,
      }}
    >
      <div
        className={`rounded-lg overflow-hidden ${isDragging
          ? 'cursor-grabbing opacity-75'
          : 'cursor-grab'
          } ${isSelected
            ? 'shadow-lg shadow-gray-800/80'
            : 'hover:shadow-md shadow-gray-600/50'
          }`}
        onClick={() => onSelect(image.id)}
        onMouseDown={handleMouseDown}
      >
        {image.image_url ? (
          <div className="relative">
            <img
              src={image.image_url}
              alt={image.prompt}
              className="w-full h-auto"
              onLoad={handleImageLoad}
            />
            {(isGenerating || !isImageLoaded) && (
              <div className="absolute inset-0 backdrop-blur-xs flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-white/40 rounded-full animate-spin border-t-white shadow-lg shadow-white/20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-white/80 rounded-full animate-pulse shadow-lg"></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full bg-gray-200 flex flex-col items-center justify-center" style={{ height: `${IMAGE_SIZE}px` }}>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <div className="animate-pulse">Generating...</div>
          </div>
        )}

        {/* Delete button - visible on hover, top-left (hidden for temp images) */}
        {!image.id.startsWith('temp-') && (
          <button
            className="absolute top-2 left-2 bg-white bg-opacity-90 hover:bg-red-500 hover:text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            onClick={handleDeleteClick}
            title="Delete image"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* Clone button - visible on hover, top-right */}
        <button
          className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-gray-200 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          onClick={handleCloneClick}
          title="Clone image"
        >
          <Copy size={16} />
        </button>

        {/* Magic variations button - visible on hover, bottom-right */}
        <button
          className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-purple-500 hover:text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          onClick={handleVariationsClick}
          title="Generate variations"
        >
          <Sparkles size={16} />
        </button>

      </div>

      {/* Prompt tooltip - visible on hover, drops below image (outside overflow container) */}
      <div className="absolute top-full left-0 right-0 bg-black bg-opacity-80 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0 rounded-lg">
        <div className="line-clamp-4 break-words">
          {image.prompt || 'Generating...'}
        </div>
      </div>

    </div>
  )
}
