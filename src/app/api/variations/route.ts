import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export async function generateVariations(prompt: string): Promise<string[]> {
  const result = await generateText({
    model: openai('gpt-4.1-nano'),
    system: `The user will provide a prompt used to generate an image. Your job is to generate 4 variations of that prompt with changes in artistic style, composition or content. Please respond with only the suggested variations, one per line.

<exampleResponse>
First variation here...
Second variation here...
Third variation here...
Fourth variation here...
</ exampleResponse >`,
    prompt
  })

  // Split the response into individual variation lines and filter out empty lines
  const variations = result.text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, 4) // Ensure we only take the first 4 variations

  return variations
}

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
