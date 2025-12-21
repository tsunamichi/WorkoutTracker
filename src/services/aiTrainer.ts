import OpenAI from 'openai';

interface TrainerContext {
  apiKey: string;
  goals?: string;
  personality?: string;
}

interface WorkoutData {
  cycleLength: number;
  workoutsPerWeek: number;
  workouts: {
    name: string;
    exercises: {
      name: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      weight: number;
    }[];
  }[];
}

export async function generateCycleWithAI(
  prompt: string,
  context: TrainerContext
): Promise<WorkoutData> {
  if (!context.apiKey || !context.apiKey.startsWith('sk-')) {
    throw new Error('Invalid or missing OpenAI API key');
  }

  const openai = new OpenAI({
    apiKey: context.apiKey,
    dangerouslyAllowBrowser: true, // For React Native
  });

  const systemPrompt = `You are an expert personal trainer helping users create workout programs.

User's Goals: ${context.goals || 'General fitness'}
Trainer Personality: ${context.personality || 'Professional and encouraging'}

IMPORTANT: You must respond ONLY with valid JSON in this exact format:
{
  "cycleLength": <number of weeks>,
  "workoutsPerWeek": <number of workouts per week>,
  "workouts": [
    {
      "name": "<workout name, e.g., Push A, Pull B>",
      "exercises": [
        {
          "name": "<exercise name>",
          "sets": <number>,
          "repsMin": <min reps>,
          "repsMax": <max reps>,
          "weight": <starting weight in lbs>
        }
      ]
    }
  ]
}

CRITICAL Rules:
- The "workouts" array contains BASE TEMPLATES (Week 1 values) that repeat each week
- DO NOT create separate entries for each week (e.g., don't create "Push Week 1", "Push Week 2")
- Each workout should appear ONLY ONCE in the array
- Use Week 1 values as the starting point - the app will calculate progression automatically
- If the user specifies week-by-week progression (e.g., "Week 1: 90lbs, Week 2: 100lbs"), use Week 1 values and note the progression pattern
- Create realistic, balanced workout programs
- Use proper exercise names (e.g., "Bench Press", "Squat", "Deadlift")
- Sets should be 3-5, reps 5-12 typically
- Weight should be conservative starting weights (use Week 1 if specified by user)
- Include 4-7 exercises per workout
- No markdown, no code blocks, ONLY the raw JSON object

Default Weekly Schedule (unless user specifies otherwise):
- Monday: Push (chest, shoulders, triceps)
- Tuesday: Full Body A (compound movements)
- Wednesday: Legs (quads, hamstrings, glutes)
- Thursday: Rest day (no workout)
- Friday: Pull (back, biceps)
- Saturday: Full Body B (accessory movements)
- Sunday: Legs (lower body focus)

Name workouts accordingly (e.g., "Push", "Full Body A", "Legs", "Pull", "Full Body B")`;

  try {
    console.log('🤖 Calling OpenAI API...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log('📥 AI Response length:', responseText.length);
    console.log('📥 AI Response preview:', responseText.substring(0, 200) + '...');
    
    // Check if response was cut off
    if (completion.choices[0]?.finish_reason === 'length') {
      console.error('❌ Response was truncated due to token limit');
      throw new Error('AI response was too long and got cut off. Please try a shorter request.');
    }

    if (!responseText) {
      throw new Error('AI returned an empty response');
    }

    // Try to parse JSON - handle both raw JSON and markdown code blocks
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    
    // Try to find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Could not find JSON in response');
      console.error('   Response was:', jsonText.substring(0, 500));
      throw new Error('AI response did not contain valid JSON');
    }

    let workoutData: WorkoutData;
    try {
      workoutData = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError.message);
      console.error('   Attempted to parse:', jsonMatch[0].substring(0, 500));
      console.error('   Full response:', responseText);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }
    
    // Validate structure
    if (!workoutData.cycleLength || !workoutData.workouts || workoutData.workouts.length === 0) {
      throw new Error('AI response missing required fields');
    }

    console.log('✅ AI generated cycle successfully!');
    console.log(`   ${workoutData.cycleLength} weeks, ${workoutData.workouts.length} workouts`);

    return workoutData;
  } catch (error: any) {
    console.error('❌ OpenAI API Error:', error.message);
    throw new Error(`AI Error: ${error.message}`);
  }
}

