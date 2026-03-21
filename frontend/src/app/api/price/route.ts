import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchString } = await request.json()

    if (!searchString) {
      return NextResponse.json({ error: 'No search string provided' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Act as an expert sports card appraiser. I need you to provide a highly accurate estimate of the current real-world market value for the following sports card based on recent sales:
    
    "${searchString}"
    
    Calculate the estimated highest selling price, the lowest selling price, and the average selling price.
    
    Return ONLY a strictly valid JSON object exactly like this:
    {"high": 125.50, "low": 85.00, "avg": 105.25}

    Do not include any markdown, explanation, or code block formatting. Return exclusively the JSON object and ensure the values are Numbers, not Strings.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim()
    const json = JSON.parse(cleanedText)

    if (typeof json.high !== 'number' || typeof json.low !== 'number' || typeof json.avg !== 'number') {
        throw new Error("Invalid schema returned from AI Appraiser")
    }

    return NextResponse.json({
      high: Number(json.high.toFixed(2)),
      low: Number(json.low.toFixed(2)),
      avg: Number(json.avg.toFixed(2)),
    })
  } catch (error: any) {
    console.error('AI Appraisal Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate comps' }, { status: 500 })
  }
}
