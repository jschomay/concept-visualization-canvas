import { Image } from '../lib/images'
import { Copy } from 'lucide-react'

interface ImageTileProps {
  image: Image
  isSelected: boolean
  onSelect: (imageId: string) => void
  onClone: (imageId: string) => void
}

export default function ImageTile({ image, isSelected, onSelect, onClone }: ImageTileProps) {
  const handleCloneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClone(image.id)
  }

  return (
    <div
      key={image.id}
      className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all ${isSelected
        ? 'shadow-lg shadow-gray-800/80'
        : 'hover:shadow-md shadow-gray-600/50'
        }`}
      onClick={() => onSelect(image.id)}
    >
      <img
        src={image.image_url}
        alt={image.prompt}
        className="w-full h-auto"
      />

      {/* Clone button - visible on hover */}
      <button
        className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-gray-200 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        onClick={handleCloneClick}
        title="Clone image"
      >
        <Copy size={16} />
      </button>

    </div>
  )
}
