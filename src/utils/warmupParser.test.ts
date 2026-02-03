import { parseWarmupText, convertToWarmupItems } from './warmupParser';

// Your exact example
const yourWarmupExample = `- 90/90 Hip Rotations x 6 reps
- World's Greatest Stretch x 5 reps
- Half-Kneeling Hip Flexor 30 sec
repeat this superset 2 times

- Knee-to-Wall Ankle Mobilization x 8
- Wall Sit x 45sec
repeat this superset 2 times

- Quadruped Thoracic Rotations x 6 reps
- Scapular Push-Ups x 8 reps
repeat this superset 2 times`;

console.log('=== PARSING YOUR WARM-UP EXAMPLE ===\n');

// Parse the text
const parsedGroups = parseWarmupText(yourWarmupExample);

console.log('Parsed Groups:');
parsedGroups.forEach((group, index) => {
  console.log(`\nGroup ${index + 1}:`);
  console.log(`  Is Cycle/Superset: ${group.isCycle}`);
  console.log(`  Rounds: ${group.rounds}`);
  console.log(`  Exercises:`);
  group.exercises.forEach((ex, exIndex) => {
    console.log(`    ${exIndex + 1}. ${ex.name}`);
    if (ex.isTimeBased) {
      console.log(`       ${ex.seconds} seconds`);
    } else {
      console.log(`       ${ex.reps} reps`);
    }
  });
});

// Convert to WarmupItems (the format used in the app)
const warmupItems = convertToWarmupItems(parsedGroups);

console.log('\n\n=== CONVERTED TO APP FORMAT ===\n');
console.log(JSON.stringify(warmupItems, null, 2));

/*
Expected output:

Group 1:
  Is Cycle/Superset: true
  Rounds: 2
  Exercises:
    1. 90/90 Hip Rotations (6 reps)
    2. World's Greatest Stretch (5 reps)
    3. Half-Kneeling Hip Flexor (30 seconds)

Group 2:
  Is Cycle/Superset: true
  Rounds: 2
  Exercises:
    1. Knee-to-Wall Ankle Mobilization (8 reps)
    2. Wall Sit (45 seconds)

Group 3:
  Is Cycle/Superset: true
  Rounds: 2
  Exercises:
    1. Quadruped Thoracic Rotations (6 reps)
    2. Scapular Push-Ups (8 reps)
*/
