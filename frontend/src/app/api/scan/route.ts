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
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const backFile = formData.get('back_image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Image = buffer.toString('base64')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Examine this baseball card image meticulously. Return ONLY a valid JSON object with exactly these keys: 'player_name', 'team_name', 'year', 'card_set', 'parallel_insert_type', 'card_number', and 'side' (must exactly be 'Front', 'Back', or 'Dual'). It is absolutely critical that you correctly extract the 'card_number', as this is used for database joining. 

*** CRITICAL INSTRUCTION FOR 'parallel_insert_type' ***
Sports cards frequently have rare 'Parallel' or 'Insert' variations. You MUST look extremely closely at the card for ANY of the following:
1. Words describing special variations printed directly on the card (like 'Refractor', 'Prizm', 'Holo', 'Chrome', 'Silver', 'Crystal').
2. Unique or distinct colored borders/backgrounds (e.g. Red, Blue, Gold, Camo, Mojo, Wave).
3. Stamped serial numbers indicating a limited print run (e.g. 10/99).
4. Sub-set Insert names (e.g. 'Downtown', 'Kaboom', 'Home Run Challenge').
If ANY of these visual styles, foil types, or names are present, you MUST populate 'parallel_insert_type' with a highly descriptive name (e.g. 'Blue Refractor', 'Silver Prizm', '#/99', 'Gold Border'). Never default to an empty string if the card is visually holographic or has a distinct color scheme! Only leave empty if it is a truly standard, non-holographic Base card.`

    const parts: any[] = [
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: file.type || 'image/jpeg',
        },
      }
    ]

    if (backFile) {
        const backBuffer = Buffer.from(await backFile.arrayBuffer())
        parts.push({
            inlineData: {
                data: backBuffer.toString('base64'),
                mimeType: backFile.type || 'image/jpeg'
            }
        })
        parts.push("Note: 2 distinct images have been provided, one is the Front and one is the Back. Please meticulously synthesize all data points combined from both sides of the card into a singular, comprehensive JSON output. Explicitly mark the 'side' parameter as 'Dual'.")
    }

    const result = await model.generateContent(parts)

    const text = result.response.text()
    console.log('Gemini text:', text)
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim()
    
    let json = {}
    try {
      json = JSON.parse(cleanedText)
    } catch (e) {
      console.error("Failed to parse JSON:", e, cleanedText)
      throw new Error("AI returned invalid data format.")
    }

    // Flatten if wrapped in a single root key
    const keys = Object.keys(json)
    if (keys.length === 1 && typeof (json as any)[keys[0]] === 'object') {
      json = (json as any)[keys[0]]
    }

    // Case insensitive mapping
    const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalizedJson: any = {}
    for (const [k, v] of Object.entries(json)) {
      normalizedJson[normalizeKey(k)] = v
    }

    const parsedSide = normalizedJson['side'] || (json as any).side || 'Front'

    const finalResponse = {
      player_name: normalizedJson['playername'] || normalizedJson['player'] || (json as any).player_name || '',
      team_name: normalizedJson['teamname'] || normalizedJson['team'] || (json as any).team_name || '',
      year: normalizedJson['year'] || (json as any).year || '',
      card_set: normalizedJson['cardset'] || normalizedJson['set'] || (json as any).card_set || '',
      parallel_insert_type: normalizedJson['parallelinserttype'] || normalizedJson['parallel'] || normalizedJson['insert'] || (json as any).parallel_insert_type || '',
      card_number: normalizedJson['cardnumber'] || normalizedJson['cardid'] || normalizedJson['number'] || (json as any).card_number || '',
      side: parsedSide === 'Dual' ? 'Dual' : (parsedSide === 'Back' ? 'Back' : 'Front')
    }

    console.log('Final API output sent to client:', finalResponse)

    return NextResponse.json(finalResponse)
  } catch (error: any) {
    console.error('Scan Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to scan image' }, { status: 500 })
  }
}
