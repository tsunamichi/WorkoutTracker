import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';
import type { Cycle, WorkoutTemplate, WorkoutTemplateExercise } from '../types';
import { calculateCycleEndDate } from '../utils/progression';
import { generateCycleWithAI } from '../services/aiTrainer';
import { IconSave } from './icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TrainerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function TrainerBottomSheet({ visible, onClose }: TrainerBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { cycles, exercises, addCycle, addExercise, getNextCycleNumber, settings } = useStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const cycleNumber = getNextCycleNumber();
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;
  
  // Check if AI is configured
  const hasAI = settings.openaiApiKey && settings.openaiApiKey.startsWith('sk-');
  
  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      const plan = generateCyclePlan(prompt, cycleNumber);
      setGeneratedPlan(plan);
      setIsGenerating(false);
    }, 2000);
  };
  
  const handleSave = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      let newCycle: Cycle;
      
      // Check if user provided structured week-by-week input (for exact 1:1 parsing)
      const hasWeekHeaders = /Week\s+\d+/i.test(prompt);
      const hasStructuredFormat = /[×xX]\s*\d+\s*@/i.test(prompt);
      
      if (hasWeekHeaders && hasStructuredFormat) {
        // User provided structured input - parse directly for exact 1:1 match
        console.log('📋 Detected structured week-by-week format - parsing directly (bypassing AI for exact match)');
        newCycle = parsePlanIntoCycle(prompt, cycleNumber);
      } else if (hasAI) {
        // Use AI to generate cycle from natural language
        console.log('🤖 Using AI to generate cycle...');
        const aiData = await generateCycleWithAI(prompt, {
          apiKey: settings.openaiApiKey!,
          goals: settings.trainerGoals,
          personality: settings.trainerPersonality,
        });
        
        // Convert AI response to Cycle format
        newCycle = convertAIDataToCycle(aiData, cycleNumber);
      } else {
        // Fallback to regex parsing
        console.log('📝 Using regex parsing (no AI key)...');
        const plan = generateCyclePlan(prompt, cycleNumber);
        newCycle = parsePlanIntoCycle(plan, cycleNumber);
      }
      
      console.log('About to save cycle:', newCycle);
      console.log('Cycle has', newCycle.workoutTemplates.length, 'workouts');
      newCycle.workoutTemplates.forEach((t, idx) => {
        console.log(`  [${idx}] ${t.name} - Day ${t.dayOfWeek || 'NONE'} (ID: ${t.id}):`, t.exercises.length, 'exercises');
        t.exercises.forEach(e => console.log('    -', e));
      });
      
      // Check for duplicate day assignments
      const dayAssignments: Record<number, string[]> = {};
      newCycle.workoutTemplates.forEach(t => {
        if (t.dayOfWeek) {
          if (!dayAssignments[t.dayOfWeek]) dayAssignments[t.dayOfWeek] = [];
          dayAssignments[t.dayOfWeek].push(t.name);
        }
      });
      console.log('Day Assignments:');
      Object.entries(dayAssignments).forEach(([day, workouts]) => {
        console.log(`  Day ${day}: ${workouts.join(', ')}${workouts.length > 1 ? ' ⚠️ DUPLICATE!' : ''}`);
      });
      
      // Create the cycle
      await addCycle(newCycle);
      
      console.log('Cycle saved!');
      
      // Reset and close
      setPrompt('');
      setGeneratedPlan('');
      setIsGenerating(false);
      onClose();
    } catch (error: any) {
      console.error('❌ Error generating cycle:', error);
      setIsGenerating(false);
      Alert.alert(
        'Error',
        error.message || 'Failed to generate cycle. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const generateCyclePlan = (userPrompt: string, cycleNum: number): string => {
    // If already formatted, return as-is
    if (userPrompt.includes('Week') && userPrompt.includes(':') && userPrompt.includes('×')) {
      return `## Cycle ${cycleNum} Plan\n\n${userPrompt}`;
    }
    
    // Otherwise, parse old format for backward compatibility
    const lowerPrompt = userPrompt.toLowerCase();
    let split = 'push/pull/legs';
    if (lowerPrompt.includes('full body') || lowerPrompt.includes('3 day')) {
      split = 'full body';
    } else if (lowerPrompt.includes('upper') && lowerPrompt.includes('lower')) {
      split = 'upper/lower';
    }
    
    let weeks = 8;
    if (lowerPrompt.match(/(\d+)\s*week/)) {
      weeks = parseInt(lowerPrompt.match(/(\d+)\s*week/)![1]);
    }
    
    return `## Cycle ${cycleNum} Plan

Week 1

${split === 'push/pull/legs' ? `Push: Push A
- Bench Press: 4 × 6-8 @ 50kg
- Overhead Press: 3 × 8-10 @ 35kg
- Incline Press: 3 × 10-12 @ 30kg
- Lateral Raises: 3 × 12-15 @ 15kg
- Tricep Pushdowns: 3 × 12-15 @ 20kg

Pull: Pull A
- Deadlift: 4 × 5-6 @ 80kg
- Pull-ups: 3 × 8-10 @ 0kg
- Barbell Rows: 3 × 8-10 @ 50kg
- Face Pulls: 3 × 15-20 @ 15kg
- Bicep Curls: 3 × 10-12 @ 15kg

Legs: Legs A
- Squats: 4 × 6-8 @ 100kg
- Romanian Deadlifts: 3 × 8-10 @ 60kg
- Leg Press: 3 × 10-12 @ 120kg
- Leg Curls: 3 × 12-15 @ 40kg
- Calf Raises: 4 × 15-20 @ 60kg` : split === 'upper/lower' ? `Upper: Upper A
- Bench Press: 4 × 6-8 @ 50kg
- Pull-ups: 3 × 8-10 @ 0kg
- Overhead Press: 3 × 8-10 @ 35kg
- Barbell Rows: 3 × 8-10 @ 50kg
- Dumbbell Curls: 3 × 10-12 @ 15kg

Lower: Lower A
- Squats: 4 × 6-8 @ 100kg
- Romanian Deadlifts: 3 × 8-10 @ 60kg
- Leg Press: 3 × 10-12 @ 120kg
- Leg Curls: 3 × 12-15 @ 40kg
- Calf Raises: 4 × 15-20 @ 60kg` : `Full Body: Full Body A
- Squats: 3 × 6-8 @ 100kg
- Bench Press: 3 × 6-8 @ 50kg
- Pull-ups: 3 × 8-10 @ 0kg
- Overhead Press: 3 × 8-10 @ 35kg
- Romanian Deadlifts: 3 × 8-10 @ 60kg
- Plank: 3 × 45-60 @ 0kg`}

**Duration:** ${weeks} weeks
**Progression:** Add 2.5kg to upper body and 5kg to lower body movements each week.`;
  };
  
  const parsePlanIntoCycle = (plan: string, cycleNum: number): Cycle => {
    // Check if plan contains multiple weeks - match "Week 1", "WEEK 1", "⭐️ WEEK 1", etc.
    // ONLY at start of line (after newline or at beginning) to avoid matching "(formerly Week 2)" in text
    const weekHeaders = [...plan.matchAll(/(?:^|\n)(?:⭐️\s*)?WEEK\s+(\d+)/gim)];
    const weeks = weekHeaders.length > 0 ? Math.max(...weekHeaders.map(m => parseInt(m[1]))) : 1;
    
    console.log('Parsed cycle length:', weeks, 'weeks');
    console.log('Week headers found:', weekHeaders.length);
    weekHeaders.forEach((h, i) => console.log(`  Week ${h[1]} at index ${h.index}: "${h[0].trim()}"`));
    
    // Extract Week 1 section to create base templates (but keep full plan for progression calculation)
    let week1Section = plan;
    if (weekHeaders.length > 1) {
      const week1Start = weekHeaders[0].index!;
      const week2Start = weekHeaders[1].index!;
      week1Section = plan.substring(week1Start, week2Start);
      console.log('📋 Extracted Week 1 section (length:', week1Section.length, ')');
      console.log('📋 Week 1 preview:', week1Section.substring(0, 300));
      console.log('📋 Full plan available for progression calculation');
    } else {
      console.log('📋 Single week or no week headers - using full plan');
    }
    
    // Parse workouts from the structured format
    const templates: WorkoutTemplate[] = [];
    const processedWorkoutNames = new Set<string>(); // Track processed workouts to avoid duplicates
    
    console.log('=== PARSING PLAN ===');
    console.log('Week 1 section FULL TEXT:');
    console.log(week1Section);
    console.log('=== END Week 1 section ===');
    
    // Find all workout headers - support "DAY X — Name" format
    // Support various dash types: hyphen (-), en dash (–), em dash (—)
    const workoutHeaderRegex = /DAY\s+\d+\s*[\-–—]\s*([^\n]+)/gi;
    const matches = [...week1Section.matchAll(workoutHeaderRegex)];
    console.log('Found', matches.length, 'workout headers in Week 1');
    
    if (matches.length === 0) {
      console.log('⚠️ NO WORKOUT HEADERS FOUND! Checking for alternative formats...');
      // Test different patterns
      console.log('Contains "DAY"?', week1Section.includes('DAY'));
      console.log('Contains "Pull"?', week1Section.includes('Pull'));
      console.log('Contains "—"?', week1Section.includes('—'));
      
      // Show all lines
      const lines = week1Section.split('\n');
      console.log('All lines in Week 1 section:');
      lines.forEach((line, i) => console.log(`  Line ${i}: "${line}"`));
    }
    
    matches.forEach((m, i) => console.log(`  Match ${i + 1}: "${m[0]}" -> Workout: "${m[1]}"`));
    
    // Extract sections manually from Week 1
    const workoutSections: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      const startIndex = currentMatch.index!;
      const endIndex = nextMatch ? nextMatch.index! : week1Section.length;
      
      const section = week1Section.substring(startIndex, endIndex).trim();
      workoutSections.push(section);
      console.log(`Workout ${i + 1}:`, currentMatch[1], '- Section length:', section.length, 'chars');
      console.log(`  Preview: ${section.substring(0, 100)}`);
    }
    
    console.log('Total workout sections from Week 1:', workoutSections.length);
    
    for (const section of workoutSections) {
      console.log('--- Processing section ---');
      console.log('Section:', section.substring(0, 100));
      
      // Extract workout type and name from "DAY X — Name" format
      const headerMatch = section.match(/^DAY\s+\d+\s*[—–-]\s*(.+)/i);
      if (!headerMatch) {
        console.log('No header match for section');
        continue;
      }
      
      const workoutName = headerMatch[1].trim();
      const workoutType = workoutName.includes('Full Body') ? 'Full Body' : workoutName.split(' ')[0]; // "Pull", "Push", "Legs", "Full Body A", etc.
      console.log('Workout:', workoutName, 'Type:', workoutType);
      
      // Extract exercises (lines starting with "- " or "• ")
      const exerciseLines = section.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('-') || trimmed.startsWith('•');
      });
      console.log('Found', exerciseLines.length, 'exercise lines');
      const parsedExercises: WorkoutTemplateExercise[] = [];
      
      for (const line of exerciseLines) {
        // Parse format: "• Exercise name — sets × reps @ weight" or "- Exercise name: sets × reps @ weight"
        // Supports leading whitespace (tabs/spaces), bullet "•" or dash "-", separators ":" or "—", kg/lbs/lb/BW, weight ranges, time-based reps
        const exerciseMatch = line.match(/^\s*[•\-]\s*(.+?)\s*[:\-—–]\s*(\d+)\s*[×xX]\s*([\d\s\w]+?)(?:\s*@\s*(.+?))?$/i);
        if (!exerciseMatch) {
          console.log('Failed to parse line:', line);
          console.log('Line bytes:', Array.from(line).map(c => c.charCodeAt(0)));
          continue;
        }
        
        const [, exerciseName, sets, repsRaw, weightRaw] = exerciseMatch;
        
        // Parse reps - could be "10", "10-12", or "1 min"
        let repsMin: number | string = 10;
        let repsMax: number | string = 10;
        
        const repsRangeMatch = repsRaw.match(/^(\d+)[\-–—](\d+)$/);
        if (repsRangeMatch) {
          repsMin = parseInt(repsRangeMatch[1]);
          repsMax = parseInt(repsRangeMatch[2]);
        } else if (/^\d+$/.test(repsRaw.trim())) {
          repsMin = repsMax = parseInt(repsRaw);
        } else {
          // Time-based or other format like "1 min"
          repsMin = repsMax = repsRaw.trim();
        }
        
        // Parse weight - could be "100 lb", "BW", "light", "+20 lb", "12.5-15 lb"
        let weight: number | string = 0;
        
        if (!weightRaw || weightRaw.trim().toLowerCase() === 'bw') {
          weight = 0; // Bodyweight
        } else if (weightRaw.trim().toLowerCase() === 'light') {
          weight = 'light';
        } else {
          const weightRangeMatch = weightRaw.match(/([\d.+]+)[\-–—]([\d.]+)\s*(?:kg|lbs?)?/i);
          const singleWeightMatch = weightRaw.match(/([+\d.]+)\s*(?:kg|lbs?)?/i);
          
          if (weightRangeMatch) {
            // Use average of range
            const w1 = parseFloat(weightRangeMatch[1].replace('+', ''));
            const w2 = parseFloat(weightRangeMatch[2]);
            weight = Math.round((w1 + w2) / 2 * 10) / 10;
          } else if (singleWeightMatch) {
            weight = parseFloat(singleWeightMatch[1].replace('+', ''));
          } else {
            weight = 0;
          }
        }
        
        console.log(`✅ Parsed: ${exerciseName.trim()} - ${sets}×${typeof repsMin === 'number' ? `${repsMin}${repsMax !== repsMin ? `-${repsMax}` : ''}` : repsMin} @ ${weight === 0 ? 'BW' : weight}`);
        
        // Find or create exercise in library
        let exercise = exercises.find(e => 
          e.name.toLowerCase() === exerciseName.toLowerCase()
        );
        
        if (!exercise) {
          // Create new exercise
          const newExercise = {
            id: `ex-${Date.now()}-${Math.random()}`,
            name: exerciseName,
            category: categorizeExercise(exerciseName),
            equipment: inferEquipment(exerciseName),
            isCustom: true,
          };
          console.log('Creating new exercise:', exerciseName, '- Equipment:', inferEquipment(exerciseName));
          addExercise(newExercise); // Save to store!
          exercise = newExercise;
        }
        
        // Parse ALL weeks for this exercise to get exact user-provided values (1:1 match)
        const escapedName = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const weeklyOverrides: Record<number, any> = {};
        
        // Store Week 1 (base values)
        weeklyOverrides[1] = {
          targetWeight: weight,
          targetSets: sets,
          targetRepsMin: repsMin,
          targetRepsMax: repsMax,
        };
        console.log(`📋 Week 1 ${exerciseName}: ${sets}×${repsMin}${repsMax !== repsMin ? '-' + repsMax : ''} @ ${weight}lbs (EXACT USER INPUT)`);
        
        // Parse values from all other weeks - support bullet points, em dashes, tabs, and flexible formats
        let progressionValue = 0;
        for (let w = 2; w <= weeks; w++) {
          console.log(`\n🔍 Searching for "${exerciseName.trim()}" in Week ${w}...`);
          
          // Extract the Week section using a simple indexOf approach
          const weekHeaderPattern = `⭐️ WEEK ${w}`;
          const weekStartIndex = plan.indexOf(weekHeaderPattern);
          
          if (weekStartIndex === -1) {
            console.log(`⚠️ Week ${w} header not found in plan`);
            continue;
          }
          
          // Find the next week header (if any)
          const nextWeekPattern = `⭐️ WEEK ${w + 1}`;
          const nextWeekIndex = plan.indexOf(nextWeekPattern);
          
          // Extract from current week to next week (or end of string)
          const weekSection = nextWeekIndex === -1 
            ? plan.substring(weekStartIndex)
            : plan.substring(weekStartIndex, nextWeekIndex);
          
          console.log(`📄 Week ${w} section found (${weekSection.length} chars)`);
          console.log(`📄 Week ${w} FULL SECTION:`);
          console.log(weekSection.substring(0, 500));
          console.log(`📄 Week ${w} section ends with: ...${weekSection.substring(Math.max(0, weekSection.length - 100))}`);
          
          // Now look for the exercise in this section
          const exercisePattern = new RegExp(`\\s*[•\\-]\\s*${escapedName}\\s*[:\\-—–]\\s*(\\d+)\\s*[×xX]\\s*([\\d\\s\\w]+?)\\s*(?:@\\s*(.+?))?(?:\\n|$)`, 'i');
          const weekMatch = weekSection.match(exercisePattern);
          
          
          if (weekMatch) {
              console.log(`✅ Found exercise in Week ${w}:`, weekMatch[0].trim());
              const weekSets = parseInt(weekMatch[1]);
              const weekRepsRaw = weekMatch[2].trim();
              const weekWeightRaw = weekMatch[3];
              
              // Parse reps
              let weekRepsMin: number | string = 10;
              let weekRepsMax: number | string = 10;
              const weekRepsRangeMatch = weekRepsRaw.match(/^(\d+)[\-–—](\d+)$/);
              if (weekRepsRangeMatch) {
                weekRepsMin = parseInt(weekRepsRangeMatch[1]);
                weekRepsMax = parseInt(weekRepsRangeMatch[2]);
              } else if (/^\d+$/.test(weekRepsRaw)) {
                weekRepsMin = weekRepsMax = parseInt(weekRepsRaw);
              } else {
                weekRepsMin = weekRepsMax = weekRepsRaw;
              }
              
              // Parse weight
              let weekWeight: number | string = 0;
              if (!weekWeightRaw || weekWeightRaw.trim().toLowerCase() === 'bw') {
                weekWeight = 0;
              } else if (weekWeightRaw.trim().toLowerCase() === 'light') {
                weekWeight = 'light';
              } else {
                const wRangeMatch = weekWeightRaw.match(/([\d.+]+)[\-–—]([\d.]+)\s*(?:kg|lbs?)?/i);
                const wSingleMatch = weekWeightRaw.match(/([+\d.]+)\s*(?:kg|lbs?)?/i);
                if (wRangeMatch) {
                  const w1 = parseFloat(wRangeMatch[1].replace('+', ''));
                  const w2 = parseFloat(wRangeMatch[2]);
                  weekWeight = Math.round((w1 + w2) / 2 * 10) / 10;
                } else if (wSingleMatch) {
                  weekWeight = parseFloat(wSingleMatch[1].replace('+', ''));
                }
              }
              
              weeklyOverrides[w] = {
                targetWeight: weekWeight,
                targetSets: weekSets,
                targetRepsMin: weekRepsMin,
                targetRepsMax: weekRepsMax,
              };
              
              console.log(`📋 Week ${w} ${exerciseName.trim()}: ${weekSets}×${typeof weekRepsMin === 'number' ? `${weekRepsMin}${weekRepsMax !== weekRepsMin ? '-' + weekRepsMax : ''}` : weekRepsMin} @ ${weekWeight === 0 ? 'BW' : weekWeight} (EXACT USER INPUT)`);
              
              // Calculate progression from Week 1 to Week 2 for fallback
              if (w === 2 && typeof weight === 'number' && typeof weekWeight === 'number') {
                progressionValue = Math.abs(weekWeight - weight);
              }
            } else {
              console.log(`⚠️ Exercise "${exerciseName.trim()}" NOT FOUND in Week ${w} section`);
            }
        }
        
        console.log(`✅ Stored ${Object.keys(weeklyOverrides).length} weeks of exact values for ${exerciseName}`);
        console.log('Weekly Overrides:', JSON.stringify(weeklyOverrides, null, 2));
        
        const newExercise = {
          id: `${Date.now()}-${Math.random()}`,
          exerciseId: exercise.id,
          orderIndex: parsedExercises.length,
          targetSets: parseInt(sets.toString()),
          targetRepsMin: typeof repsMin === 'number' ? repsMin : 10,
          targetRepsMax: typeof repsMax === 'number' ? repsMax : 10,
          targetWeight: typeof weight === 'number' ? weight : 0,
          progressionType: 'weight' as const,
          progressionValue: progressionValue || (typeof weight === 'number' && weight >= 50 ? 5 : 2.5),
          weeklyOverrides, // Store exact user values for each week (can include strings)
        };
        console.log('Added exercise:', exerciseName, 'with weeklyOverrides:', JSON.stringify(weeklyOverrides));
        parsedExercises.push(newExercise);
      }
      
      if (parsedExercises.length > 0) {
        const mappedWorkoutType = mapWorkoutType(workoutType);
        const dayOfWeek = assignDayOfWeek(workoutName, mappedWorkoutType, templates);
        
        const template = {
          id: `${Date.now()}-${Math.random()}`,
          cycleId: cycleNum.toString(),
          name: workoutName,
          workoutType: mappedWorkoutType,
          dayOfWeek, // Auto-assigned based on workout type
          orderIndex: templates.length,
          exercises: parsedExercises,
        };
        console.log(`✅ Created template: "${workoutName}" (${mappedWorkoutType}) -> Day ${dayOfWeek || 'NONE'} with ${parsedExercises.length} exercises`);
        
        // Check if we already processed this workout type (avoid duplicates across weeks)
        const workoutKey = `${workoutName.toLowerCase()}-${dayOfWeek}`;
        if (processedWorkoutNames.has(workoutKey)) {
          console.log(`⚠️ DUPLICATE DETECTED: "${workoutName}" on Day ${dayOfWeek} already processed, skipping...`);
        } else {
          processedWorkoutNames.add(workoutKey);
          templates.push(template);
          console.log(`✅ Added template: "${workoutName}" (${templates.length} total)`);
        }
      } else {
        console.log('No exercises parsed for:', workoutName);
      }
    }
    
    const newCycle: Cycle = {
      id: Date.now().toString(),
      cycleNumber: cycleNum,
      startDate: new Date().toISOString(),
      lengthInWeeks: weeks,
      endDate: calculateCycleEndDate(new Date().toISOString(), weeks),
      workoutsPerWeek: templates.length,
      isActive: true,
      workoutTemplates: templates,
      createdAt: new Date().toISOString(),
    };
    
    console.log('=== FINAL CYCLE (parsePlanIntoCycle) ===');
    console.log('Total workouts:', templates.length);
    templates.forEach(t => {
      console.log(`- ${t.name}: ${t.exercises.length} exercises, Day: ${t.dayOfWeek || 'NONE'}`);
    });
    
    return newCycle;
  };
  
  // Helper function to assign day of week based on workout name/type
  const assignDayOfWeek = (workoutName: string, workoutType: string, existingTemplates: WorkoutTemplate[]): number | undefined => {
    const lowerWorkoutName = workoutName.toLowerCase();
    
    console.log(`🗓️ Assigning day for: "${workoutName}"`);
    console.log(`   Lower name: "${lowerWorkoutName}"`);
    
    // Monday: Push
    if (lowerWorkoutName.includes('push')) {
      console.log('   ✅ Matched PUSH -> Monday (1)');
      return 1;
    }
    
    // Tuesday: Full Body A
    if (lowerWorkoutName.includes('full') && lowerWorkoutName.includes('a')) {
      console.log('   ✅ Matched FULL DAY A -> Tuesday (2)');
      return 2;
    }
    
    // Friday: Pull (check before legs to avoid confusion)
    if (lowerWorkoutName.includes('pull')) {
      console.log('   ✅ Matched PULL -> Friday (5)');
      return 5;
    }
    
    // Saturday: Full Body B
    if (lowerWorkoutName.includes('full') && lowerWorkoutName.includes('b')) {
      console.log('   ✅ Matched FULL DAY B -> Saturday (6)');
      return 6;
    }
    
    // Wednesday (3) or Sunday (7): Legs
    if (lowerWorkoutName.includes('legs') || lowerWorkoutName.includes('leg')) {
      const existingLegs = existingTemplates.filter(t => 
        t.name.toLowerCase().includes('legs') || t.name.toLowerCase().includes('leg')
      );
      const day = existingLegs.length === 0 ? 3 : 7;
      console.log(`   ✅ Matched LEGS -> ${day === 3 ? 'Wednesday' : 'Sunday'} (${day}), existing legs: ${existingLegs.length}`);
      return day;
    }
    
    console.log('   ❌ No match found, dayOfWeek will be undefined');
    return undefined;
  };

  const convertAIDataToCycle = (aiData: any, cycleNum: number): Cycle => {
    console.log('🔄 Converting AI data to Cycle format...');
    
    const templates: WorkoutTemplate[] = [];
    
    aiData.workouts.forEach((workout: any, index: number) => {
      const templateId = `tpl-${Date.now()}-${index}`;
      
      // Parse exercises
      const exercisesList: WorkoutTemplateExercise[] = workout.exercises.map((ex: any, exIndex: number) => {
        // Find or create exercise in library
        let exercise = exercises.find(e => 
          e.name.toLowerCase() === ex.name.toLowerCase()
        );
        
        if (!exercise) {
          const newExercise = {
            id: `ex-${Date.now()}-${exIndex}`,
            name: ex.name,
            category: categorizeExercise(ex.name),
            equipment: inferEquipment(ex.name),
            isCustom: true,
          };
          console.log('Creating new exercise:', ex.name, '- Equipment:', inferEquipment(ex.name));
          addExercise(newExercise);
          exercise = newExercise;
        }
        
        return {
          id: `${templateId}-ex-${exIndex}`,
          exerciseId: exercise.id,
          orderIndex: exIndex,
          targetSets: ex.sets,
          targetRepsMin: ex.repsMin,
          targetRepsMax: ex.repsMax,
          targetWeight: ex.weight,
          progressionType: 'weight' as any,
          progressionValue: 2.5,
        };
      });
      
      const workoutType = mapWorkoutType(workout.name);
      const dayOfWeek = assignDayOfWeek(workout.name, workoutType, templates);
      
      const template = {
        id: templateId,
        cycleId: Date.now().toString(),
        name: workout.name,
        workoutType,
        dayOfWeek, // Auto-assigned based on workout type
        orderIndex: index,
        exercises: exercisesList,
      };
      
      console.log(`✅ Created template: "${workout.name}" (${workoutType}) -> Day ${dayOfWeek || 'NONE'}`);
      
      // Check if we already have a template with the same name and dayOfWeek
      const existingTemplate = templates.find(t => 
        t.name.toLowerCase() === workout.name.toLowerCase() && 
        t.dayOfWeek === dayOfWeek
      );
      
      if (existingTemplate) {
        console.log(`⚠️ DUPLICATE DETECTED: "${workout.name}" on Day ${dayOfWeek} already exists, skipping...`);
      } else {
        templates.push(template);
      }
    });
    
    console.log(`📊 Total templates after deduplication: ${templates.length}`);
    
    const newCycle: Cycle = {
      id: Date.now().toString(),
      cycleNumber: cycleNum,
      startDate: new Date().toISOString(),
      lengthInWeeks: aiData.cycleLength,
      endDate: calculateCycleEndDate(new Date().toISOString(), aiData.cycleLength),
      workoutsPerWeek: aiData.workoutsPerWeek || aiData.workouts.length,
      isActive: true,
      workoutTemplates: templates,
      createdAt: new Date().toISOString(),
    };
    
    console.log('=== FINAL CYCLE (convertAIDataToCycle) ===');
    console.log('Total workouts:', newCycle.workoutTemplates.length);
    newCycle.workoutTemplates.forEach(t => {
      console.log(`- ${t.name}: ${t.exercises.length} exercises, Day: ${t.dayOfWeek || 'NONE'}`);
    });
    
    return newCycle;
  };
  
  const categorizeExercise = (name: string): any => {
    const lower = name.toLowerCase();
    if (lower.includes('bench') || lower.includes('chest') || lower.includes('fly')) return 'Chest';
    if (lower.includes('pull') || lower.includes('row') || lower.includes('lat')) return 'Back';
    if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge')) return 'Legs';
    if (lower.includes('press') && (lower.includes('overhead') || lower.includes('shoulder'))) return 'Shoulders';
    if (lower.includes('curl') || lower.includes('tricep') || lower.includes('extension')) return 'Arms';
    if (lower.includes('dead') || lower.includes('rdl')) return 'Back';
    if (lower.includes('calf')) return 'Legs';
    return 'Other';
  };
  
  const inferEquipment = (name: string): string => {
    const lower = name.toLowerCase();
    // Barbell exercises
    if (lower.includes('bench press') || lower.includes('squat') || lower.includes('deadlift') || 
        lower.includes('overhead press') || lower.includes('barbell') || lower.includes('row')) {
      return 'Barbell';
    }
    // Bodyweight
    if (lower.includes('pull-up') || lower.includes('chin-up') || lower.includes('dip') || 
        lower.includes('push-up') || lower.includes('bodyweight')) {
      return 'Bodyweight';
    }
    // Dumbbell
    if (lower.includes('dumbbell') || lower.includes('curl') || lower.includes('lunge')) {
      return 'Dumbbell';
    }
    // Cable/Machine
    if (lower.includes('cable') || lower.includes('machine') || lower.includes('leg press')) {
      return 'Machine';
    }
    return 'Dumbbell'; // Default to dumbbell
  };
  
  const mapWorkoutType = (type: string): any => {
    const lower = type.toLowerCase();
    console.log(`🏷️ Mapping workout type: "${type}" -> Lower: "${lower}"`);
    if (lower.includes('push')) {
      console.log('   -> "Push"');
      return 'Push';
    }
    if (lower.includes('pull')) {
      console.log('   -> "Pull"');
      return 'Pull';
    }
    if (lower.includes('leg')) {
      console.log('   -> "Legs"');
      return 'Legs';
    }
    if (lower.includes('upper')) {
      console.log('   -> "Push" (from upper)');
      return 'Push';
    }
    if (lower.includes('lower')) {
      console.log('   -> "Legs" (from lower)');
      return 'Legs';
    }
    if (lower.includes('full')) {
      console.log('   -> "Full Body"');
      return 'Full Body';
    }
    console.log('   -> "Other"');
    return 'Other';
  };
  
  
  const handleClose = () => {
    setPrompt('');
    setGeneratedPlan('');
    setIsGenerating(false);
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.containerWrapper}>
          <SafeAreaView style={[styles.container, {
            borderBottomLeftRadius: deviceCornerRadius,
            borderBottomRightRadius: deviceCornerRadius,
          }]} edges={['bottom']}>
          {/* Handle - Fixed Position */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Kaio Sama</Text>
          </View>
        
        <ScrollView contentContainerStyle={styles.content}>
          {!generatedPlan ? (
            <>
              {!hasAI && (
                <>
                  <Text style={styles.formatInstructions}>
                    Format: Week [number]{'\n'}
                    [Workout Type]: [Workout Name]{'\n'}
                    - Exercise name: sets × reps @ weight
                  </Text>
                  
                  <Text style={styles.exampleTitle}>Example:</Text>
                  <Text style={styles.example}>
                    Week 8{'\n'}
                    {'\n'}
                    Push: Push A{'\n'}
                    - Bench Press: 4 × 6-8 @ 50kg{'\n'}
                    - Overhead Press: 3 × 8-10 @ 35kg{'\n'}
                {'\n'}
                Pull: Pull A{'\n'}
                - Deadlift: 4 × 5-6 @ 80kg{'\n'}
                - Pull-ups: 3 × 8-10 @ 0kg{'\n'}
                {'\n'}
                (Week number = cycle duration in weeks)
              </Text>
                </>
              )}
              
              <TextInput
                style={[styles.input, isInputFocused && styles.inputFocused]}
                placeholder={hasAI 
                  ? "E.g., Create a 6-week push/pull/legs program focused on hypertrophy. I'm intermediate level and want to train 4 days per week."
                  : "Week 8&#10;&#10;Push: Push A&#10;- Bench Press: 4 × 6-8 @ 50kg&#10;- Overhead Press: 3 × 8-10 @ 35kg&#10;&#10;Pull: Pull A&#10;- Deadlift: 4 × 5-6 @ 80kg"
                }
                placeholderTextColor={COLORS.meta}
                value={prompt}
                onChangeText={setPrompt}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
              
              {isGenerating && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                  <Text style={styles.loadingText}>Creating your cycle...</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.planTitle}>Preview</Text>
              <View style={styles.planContainer}>
                <Text style={styles.planText}>{generatedPlan}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.confirmButton}
                activeOpacity={1}
                onPress={async () => {
                  const newCycle = parsePlanIntoCycle(generatedPlan, cycleNumber);
                  await addCycle(newCycle);
                  setPrompt('');
                  setGeneratedPlan('');
                  onClose();
                }}
              >
                <Text style={styles.confirmButtonText}>Save Cycle</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.regenerateButton}
                activeOpacity={1}
                onPress={() => {
                  setGeneratedPlan('');
                  setPrompt('');
                }}
              >
                <Text style={styles.regenerateButtonText}>Start Over</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
        
        {/* Save Button - Sticky to Bottom */}
        {!isGenerating && (
          <View style={styles.saveButtonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, !prompt.trim() && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={!prompt.trim()}
              activeOpacity={1}
            >
              <IconSave size={20} color={COLORS.text} />
              <Text style={styles.saveButtonText}>Save Cycle</Text>
            </TouchableOpacity>
          </View>
        )}
        </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
  },
  containerWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    height: SCREEN_HEIGHT * 0.85,
    elevation: 10,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.textSecondary,
    opacity: 0.3,
  },
  titleContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 120, // Account for sticky save button
  },
  formatInstructions: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  exampleTitle: {
    fontSize: 15,
    marginBottom: SPACING.xs,
    fontWeight: '600' as any,
  },
  example: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 17,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    minHeight: 150,
    marginBottom: SPACING.md,
  },
  inputFocused: {
    borderColor: COLORS.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  confirmButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  confirmButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
  },
  planTitle: {
    fontSize: 22,
    marginBottom: SPACING.sm,
  },
  planContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  planText: {
    fontSize: 15,
    lineHeight: 22,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.bodyBold.fontSize,
    fontWeight: TYPOGRAPHY.bodyBold.fontWeight,
    color: COLORS.textPrimary,
  },
  regenerateButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regenerateButtonText: {
    fontSize: 17,
    color: COLORS.textPrimary,
  },
});


