import { NextRequest, NextResponse } from 'next/server'
import { generateVariations } from '../../../lib/variations'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const variations = await generateVariations(prompt)
    return NextResponse.json({ variations })
  } catch (error) {
    console.error('Error generating variations:', error)
    return NextResponse.json(
      { error: 'Failed to generate variations' },
      { status: 500 }
    )
  }
}
