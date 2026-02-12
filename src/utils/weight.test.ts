import {
  formatWeightForLoad,
  toDisplayWeight,
  fromDisplayWeight,
  formatWeight,
  lbsToKg,
  kgToLbs,
} from './weight';

// =============================================================================
// Helper: simulates the onEndEditing rounding logic used in all execution screens
// =============================================================================
function roundInputToHalf(input: string): number {
  const parsed = parseFloat(input);
  if (isNaN(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 2) / 2;
}

// =============================================================================
// 1. formatWeightForLoad — display formatting (rounds to nearest 0.5)
// =============================================================================
describe('formatWeightForLoad', () => {
  describe('lbs (useKg = false)', () => {
    test('whole numbers display without decimal', () => {
      expect(formatWeightForLoad(0, false)).toBe('0');
      expect(formatWeightForLoad(5, false)).toBe('5');
      expect(formatWeightForLoad(85, false)).toBe('85');
      expect(formatWeightForLoad(135, false)).toBe('135');
      expect(formatWeightForLoad(225, false)).toBe('225');
    });

    test('half values display with .5', () => {
      expect(formatWeightForLoad(0.5, false)).toBe('0.5');
      expect(formatWeightForLoad(2.5, false)).toBe('2.5');
      expect(formatWeightForLoad(5.5, false)).toBe('5.5');
      expect(formatWeightForLoad(12.5, false)).toBe('12.5');
      expect(formatWeightForLoad(87.5, false)).toBe('87.5');
      expect(formatWeightForLoad(132.5, false)).toBe('132.5');
    });

    test('non-0.5 values snap to nearest 0.5', () => {
      expect(formatWeightForLoad(2.3, false)).toBe('2.5');
      expect(formatWeightForLoad(2.2, false)).toBe('2');
      expect(formatWeightForLoad(2.7, false)).toBe('2.5');
      expect(formatWeightForLoad(2.8, false)).toBe('3');
      expect(formatWeightForLoad(10.1, false)).toBe('10');
      expect(formatWeightForLoad(10.3, false)).toBe('10.5');
      expect(formatWeightForLoad(99.9, false)).toBe('100');
    });
  });

  describe('kg (useKg = true)', () => {
    test('whole kg values display correctly', () => {
      // 44.09 lbs = 20 kg
      const lbs20kg = kgToLbs(20);
      expect(formatWeightForLoad(lbs20kg, true)).toBe('20');
    });

    test('half kg values display with .5', () => {
      const lbs2_5kg = kgToLbs(2.5);
      expect(formatWeightForLoad(lbs2_5kg, true)).toBe('2.5');

      const lbs10_5kg = kgToLbs(10.5);
      expect(formatWeightForLoad(lbs10_5kg, true)).toBe('10.5');
    });
  });
});

// =============================================================================
// 2. Input rounding — simulates what happens when user types and taps Done
// =============================================================================
describe('input rounding (onEndEditing)', () => {
  describe('weight input snaps to nearest 0.5', () => {
    test('whole numbers pass through', () => {
      expect(roundInputToHalf('0')).toBe(0);
      expect(roundInputToHalf('5')).toBe(5);
      expect(roundInputToHalf('8')).toBe(8);
      expect(roundInputToHalf('85')).toBe(85);
      expect(roundInputToHalf('135')).toBe(135);
    });

    test('.5 values pass through', () => {
      expect(roundInputToHalf('0.5')).toBe(0.5);
      expect(roundInputToHalf('2.5')).toBe(2.5);
      expect(roundInputToHalf('5.5')).toBe(5.5);
      expect(roundInputToHalf('12.5')).toBe(12.5);
      expect(roundInputToHalf('87.5')).toBe(87.5);
      expect(roundInputToHalf('132.5')).toBe(132.5);
    });

    test('non-.5 decimals snap correctly', () => {
      // rounds down to .0
      expect(roundInputToHalf('2.2')).toBe(2);
      expect(roundInputToHalf('2.24')).toBe(2);
      expect(roundInputToHalf('10.1')).toBe(10);

      // rounds up to .5
      expect(roundInputToHalf('2.3')).toBe(2.5);
      expect(roundInputToHalf('2.4')).toBe(2.5);
      expect(roundInputToHalf('10.3')).toBe(10.5);

      // rounds down to .5
      expect(roundInputToHalf('2.6')).toBe(2.5);
      expect(roundInputToHalf('2.7')).toBe(2.5);

      // rounds up to next whole
      expect(roundInputToHalf('2.8')).toBe(3);
      expect(roundInputToHalf('2.9')).toBe(3);
      expect(roundInputToHalf('99.9')).toBe(100);
    });

    test('edge: .25 rounds to 0.5, .75 rounds to 1.0', () => {
      expect(roundInputToHalf('0.25')).toBe(0.5);
      expect(roundInputToHalf('0.75')).toBe(1);
      expect(roundInputToHalf('5.25')).toBe(5.5);
      expect(roundInputToHalf('5.75')).toBe(6);
    });

    test('invalid inputs return NaN', () => {
      expect(roundInputToHalf('')).toBeNaN();
      expect(roundInputToHalf('abc')).toBeNaN();
      expect(roundInputToHalf('-5')).toBeNaN();
    });
  });
});

// =============================================================================
// 3. Round-trip: user enters value → stored in lbs → displayed back
// =============================================================================
describe('round-trip: input → store → display', () => {
  describe('lbs mode', () => {
    function roundTrip(input: string): string {
      const rounded = roundInputToHalf(input);
      const stored = fromDisplayWeight(rounded, false); // lbs → lbs (no-op)
      return formatWeightForLoad(stored, false);
    }

    test('whole numbers round-trip correctly', () => {
      expect(roundTrip('0')).toBe('0');
      expect(roundTrip('5')).toBe('5');
      expect(roundTrip('85')).toBe('85');
      expect(roundTrip('135')).toBe('135');
    });

    test('.5 values round-trip correctly', () => {
      expect(roundTrip('0.5')).toBe('0.5');
      expect(roundTrip('2.5')).toBe('2.5');
      expect(roundTrip('5.5')).toBe('5.5');
      expect(roundTrip('87.5')).toBe('87.5');
    });

    test('non-.5 decimals snap and round-trip', () => {
      expect(roundTrip('2.3')).toBe('2.5');
      expect(roundTrip('2.2')).toBe('2');
      expect(roundTrip('10.7')).toBe('10.5');
      expect(roundTrip('10.8')).toBe('11');
    });
  });

  describe('kg mode', () => {
    function roundTrip(input: string): string {
      const rounded = roundInputToHalf(input);
      const stored = fromDisplayWeight(rounded, true); // kg → lbs (conversion)
      return formatWeightForLoad(stored, true);         // lbs → kg display
    }

    test('whole kg values round-trip correctly', () => {
      expect(roundTrip('0')).toBe('0');
      expect(roundTrip('5')).toBe('5');
      expect(roundTrip('20')).toBe('20');
      expect(roundTrip('60')).toBe('60');
      expect(roundTrip('100')).toBe('100');
    });

    test('.5 kg values round-trip correctly', () => {
      expect(roundTrip('2.5')).toBe('2.5');
      expect(roundTrip('5.5')).toBe('5.5');
      expect(roundTrip('10.5')).toBe('10.5');
      expect(roundTrip('40.5')).toBe('40.5');
    });

    test('non-.5 kg decimals snap and round-trip', () => {
      expect(roundTrip('2.3')).toBe('2.5');
      expect(roundTrip('2.2')).toBe('2');
      expect(roundTrip('10.7')).toBe('10.5');
      expect(roundTrip('10.8')).toBe('11');
    });
  });
});

// =============================================================================
// 4. Conversion consistency — lbs ↔ kg
// =============================================================================
describe('lbs ↔ kg conversion', () => {
  test('toDisplayWeight and fromDisplayWeight are inverse in lbs mode', () => {
    expect(fromDisplayWeight(toDisplayWeight(100, false), false)).toBe(100);
    expect(fromDisplayWeight(toDisplayWeight(5.5, false), false)).toBe(5.5);
  });

  test('toDisplayWeight and fromDisplayWeight are inverse in kg mode', () => {
    const original = 100; // lbs
    const kg = toDisplayWeight(original, true);
    const backToLbs = fromDisplayWeight(kg, true);
    expect(Math.abs(backToLbs - original)).toBeLessThan(0.001);
  });

  test('common plate weights convert correctly', () => {
    // 45 lbs ≈ 20.41 kg → displays as 20.5
    expect(formatWeightForLoad(45, true)).toBe('20.5');
    // 135 lbs ≈ 61.24 kg → displays as 61
    expect(formatWeightForLoad(135, true)).toBe('61');
    // 225 lbs ≈ 102.06 kg → displays as 102
    expect(formatWeightForLoad(225, true)).toBe('102');
  });
});

// =============================================================================
// 5. Reps validation — simulates onEndEditing for reps
// =============================================================================
describe('reps input validation', () => {
  function parseRepsInput(input: string): number | null {
    const text = input.trim();
    const parsed = parseInt(text, 10);
    if (text === '' || isNaN(parsed) || parsed < 1) return null;
    return parsed;
  }

  test('valid whole numbers', () => {
    expect(parseRepsInput('1')).toBe(1);
    expect(parseRepsInput('5')).toBe(5);
    expect(parseRepsInput('8')).toBe(8);
    expect(parseRepsInput('12')).toBe(12);
    expect(parseRepsInput('100')).toBe(100);
  });

  test('decimals are truncated to integers', () => {
    expect(parseRepsInput('5.5')).toBe(5);
    expect(parseRepsInput('8.9')).toBe(8);
    expect(parseRepsInput('12.1')).toBe(12);
  });

  test('invalid inputs return null', () => {
    expect(parseRepsInput('')).toBeNull();
    expect(parseRepsInput('abc')).toBeNull();
    expect(parseRepsInput('0')).toBeNull();
    expect(parseRepsInput('-1')).toBeNull();
  });
});

// =============================================================================
// 6. Session persistence — simulates save → navigate away → restore
// =============================================================================
describe('session persistence with .5 weights', () => {
  // Simulates the localValues state management from ExerciseExecutionScreen
  type LocalValues = Record<string, { weight: number; reps: number }>;

  function initFromTemplate(items: Array<{ id: string; weight: number; reps: number }>): LocalValues {
    const merged: LocalValues = {};
    items.forEach(item => {
      if (!merged[item.id]) {
        merged[item.id] = { weight: item.weight || 0, reps: item.reps || 0 };
      }
    });
    return merged;
  }

  function restoreFromSession(
    prev: LocalValues,
    sessionSets: Array<{ exerciseId: string; setIndex: number; weight: number; reps: number }>,
    exercises: Array<{ id: string; exerciseId?: string }>,
  ): LocalValues {
    const restoredValues: LocalValues = {};
    sessionSets.forEach(set => {
      exercises.forEach(ex => {
        const exerciseIdToMatch = ex.exerciseId || ex.id;
        if (set.exerciseId === exerciseIdToMatch || set.exerciseId === ex.id) {
          const setId = `${ex.id}-set-${set.setIndex}`;
          restoredValues[setId] = { weight: set.weight, reps: set.reps };
        }
      });
    });
    return { ...prev, ...restoredValues };
  }

  test('user logs 87.5 lbs, navigates away, returns — value is preserved', () => {
    const exercises = [{ id: 'bench', exerciseId: 'bench-001' }];
    const templateItems = [{ id: 'bench', weight: 85, reps: 8 }];

    // Step 1: init from template
    let localValues = initFromTemplate(templateItems);
    expect(localValues['bench'].weight).toBe(85);

    // Step 2: user edits weight to 87.5 and completes set 0
    const rounded = Math.round(87.5 * 2) / 2;
    localValues['bench-set-0'] = { weight: rounded, reps: 8 };
    expect(localValues['bench-set-0'].weight).toBe(87.5);

    // Step 3: saveSession stores the set (simulated)
    const sessionSets = [{ exerciseId: 'bench-001', setIndex: 0, weight: 87.5, reps: 8 }];

    // Step 4: JSON round-trip (simulates AsyncStorage)
    const serialized = JSON.stringify(sessionSets);
    const deserialized = JSON.parse(serialized);
    expect(deserialized[0].weight).toBe(87.5); // .5 survives serialization

    // Step 5: user navigates away, component unmounts (localValues lost)
    localValues = {};

    // Step 6: user returns — init from template again
    localValues = initFromTemplate(templateItems);
    expect(localValues['bench'].weight).toBe(85); // template values

    // Step 7: restore from session — MERGE into existing values
    localValues = restoreFromSession(localValues, deserialized, exercises);

    // Step 8: verify the .5 value is back
    expect(localValues['bench-set-0'].weight).toBe(87.5);
    expect(localValues['bench-set-0'].reps).toBe(8);
    // Template values for unset exercises are also preserved
    expect(localValues['bench'].weight).toBe(85);
  });

  test('user logs 5.5 lbs for set 0 and 6 lbs for set 1 — both preserved', () => {
    const exercises = [{ id: 'curl', exerciseId: 'curl-001' }];
    const templateItems = [{ id: 'curl', weight: 5, reps: 12 }];

    // Init
    let localValues = initFromTemplate(templateItems);

    // Save two sets with different .5 values
    const sessionSets = [
      { exerciseId: 'curl-001', setIndex: 0, weight: 5.5, reps: 12 },
      { exerciseId: 'curl-001', setIndex: 1, weight: 6, reps: 10 },
    ];

    // Simulate navigate away and back
    localValues = {};
    localValues = initFromTemplate(templateItems);
    localValues = restoreFromSession(localValues, sessionSets, exercises);

    expect(localValues['curl-set-0'].weight).toBe(5.5);
    expect(localValues['curl-set-0'].reps).toBe(12);
    expect(localValues['curl-set-1'].weight).toBe(6);
    expect(localValues['curl-set-1'].reps).toBe(10);
  });

  test('user logs 132.5 lbs in kg mode — survives conversion round-trip', () => {
    // User enters 60.5 kg
    const inputKg = 60.5;
    const rounded = Math.round(inputKg * 2) / 2;
    expect(rounded).toBe(60.5);

    // Store as lbs
    const storedLbs = fromDisplayWeight(rounded, true); // kg → lbs

    // Simulate JSON round-trip
    const serialized = JSON.stringify({ weight: storedLbs });
    const deserialized = JSON.parse(serialized);

    // Display back as kg
    const displayed = formatWeightForLoad(deserialized.weight, true);
    expect(displayed).toBe('60.5');
  });
});

// =============================================================================
// 7. Logging scenario — simulates full set logging with .5 weights
// =============================================================================
describe('set logging with .5 weights', () => {
  test('a set with 87.5 lbs x 8 reps is stored and displayed correctly', () => {
    // User enters 87.5 in lbs mode
    const userInput = '87.5';
    const rounded = roundInputToHalf(userInput);
    expect(rounded).toBe(87.5);

    // Store internally (lbs → lbs)
    const storedWeight = fromDisplayWeight(rounded, false);
    expect(storedWeight).toBe(87.5);

    // When displayed, shows "87.5"
    expect(formatWeightForLoad(storedWeight, false)).toBe('87.5');

    // Simulate the logged set object
    const loggedSet = {
      weight: storedWeight,
      reps: 8,
      isCompleted: true,
    };
    expect(loggedSet.weight).toBe(87.5);
    expect(loggedSet.reps).toBe(8);
  });

  test('a set with 2.5 kg x 12 reps is stored and displayed correctly', () => {
    const userInput = '2.5';
    const rounded = roundInputToHalf(userInput);
    expect(rounded).toBe(2.5);

    // Store internally (kg → lbs)
    const storedWeight = fromDisplayWeight(rounded, true);
    expect(storedWeight).toBeCloseTo(kgToLbs(2.5), 5);

    // When displayed in kg, shows "2.5"
    expect(formatWeightForLoad(storedWeight, true)).toBe('2.5');

    const loggedSet = {
      weight: storedWeight,
      reps: 12,
      isCompleted: true,
    };
    expect(loggedSet.weight).toBeCloseTo(kgToLbs(2.5), 5);
    expect(loggedSet.reps).toBe(12);
  });

  test('multiple sets with varying .5 weights', () => {
    const sets = [
      { input: '135', expectedDisplay: '135' },
      { input: '137.5', expectedDisplay: '137.5' },
      { input: '140', expectedDisplay: '140' },
      { input: '142.5', expectedDisplay: '142.5' },
    ];

    sets.forEach(({ input, expectedDisplay }) => {
      const rounded = roundInputToHalf(input);
      const stored = fromDisplayWeight(rounded, false);
      expect(formatWeightForLoad(stored, false)).toBe(expectedDisplay);
    });
  });
});
