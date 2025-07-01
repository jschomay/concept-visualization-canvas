import { supabase, Image } from './supabase'

export async function saveImage(prompt: string, imageUrl: string): Promise<Image | null> {
  try {
    const { data, error } = await supabase
      .from('images')
      .insert({
        prompt,
        image_url: imageUrl,
        position_x: 0,
        position_y: 0,
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

export async function loadLatestImage(): Promise<Image | null> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned, which is fine for first time users
        return null
      }
      console.error('Error loading latest image:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error loading latest image:', error)
    return null
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