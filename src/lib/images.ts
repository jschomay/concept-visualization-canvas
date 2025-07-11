import { supabase, Image } from './supabase'

export { type Image }

export async function saveImage(prompt: string, imageUrl: string, positionX: number = 0, positionY: number = 0): Promise<Image | null> {
  try {
    const { data, error } = await supabase
      .from('images')
      .insert({
        prompt,
        image_url: imageUrl,
        position_x: positionX,
        position_y: positionY,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving image:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error saving image:', error)
    return null
  }
}


export async function loadAllImages(): Promise<Image[]> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading images:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error loading images:', error)
    return []
  }
}

export async function updateImage(id: string, prompt: string, imageUrl: string): Promise<Image | null> {
  try {
    const { data, error } = await supabase
      .from('images')
      .update({
        prompt,
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating image:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error updating image:', error)
    return null
  }
}

export async function updateImagePosition(id: string, x: number, y: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('images')
      .update({
        position_x: x,
        position_y: y,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating image position:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating image position:', error)
    return false
  }
}

export async function deleteImage(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting image:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting image:', error)
    return false
  }
}
