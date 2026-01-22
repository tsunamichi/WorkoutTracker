export type Language = 'en' | 'es';

export const DEFAULT_LANGUAGE: Language = 'en';

type TranslationKey =
  | 'today'
  | 'workouts'
  | 'noWorkoutsYet'
  | 'goToWorkouts'
  | 'start'
  | 'resume'
  | 'edit'
  | 'restDayTitle'
  | 'noWorkoutsScheduled'
  | 'swap'
  | 'createWorkout'
  | 'addWorkout'
  | 'addIntervalTimer'
  | 'addInterval'
  | 'new'
  | 'inProgress'
  | 'currentCycle'
  | 'pastCycles'
  | 'cycleNumber'
  | 'seeDetails'
  | 'newCycle'
  | 'saveAndCreate'
  | 'questionCreateWorkoutLine1'
  | 'questionCreateWorkoutLine2'
  | 'manually'
  | 'withAiHelp'
  | 'from'
  | 'to'
  | 'saveChanges'
  | 'markAsDone'
  | 'history'
  | 'reset'
  | 'complete'
  | 'skip'
  | 'noHistoryRecordedYet'
  | 'alertCompleteExerciseTitle'
  | 'alertCompleteExerciseMessage'
  | 'alertResetExerciseTitle'
  | 'alertResetExerciseMessage'
  | 'alertSkipExerciseTitle'
  | 'alertSkipExerciseMessage'
  | 'alertErrorTitle'
  | 'alertSkipFailed'
  | 'alertMissingWorkoutInfo'
  | 'createCycle'
  | 'trainingDays'
  | 'cycleLength'
  | 'weeks'
  | 'buildYourWeek'
  | 'addExercises'
  | 'back'
  | 'exercises'
  | 'addExercise'
  | 'saveDay'
  | 'addExerciseTitle'
  | 'reviewCycle'
  | 'cycleSummary'
  | 'startDate'
  | 'workoutsLabel'
  | 'editLabel'
  | 'newWorkout'
  | 'continue'
  | 'deleteExerciseTitle'
  | 'deleteExerciseMessage'
  | 'delete'
  | 'unknownExercise'
  | 'exercise'
  | 'round'
  | 'moveFor'
  | 'restAfterEachExercise'
  | 'exercisesInRound'
  | 'roundsLabel'
  | 'restBetweenRounds'
  | 'save'
  | 'createTimer'
  | 'savedTimers'
  | 'setLabel'
  | 'roundLabel'
  | 'go'
  | 'timerCompleteTitle'
  | 'timerCompleteBody'
  | 'workoutComplete'
  | 'niceWork'
  | 'nextSetOutOf'
  | 'setOf'
  | 'timerName'
  | 'saveAndReset'
  | 'welcomeTitle'
  | 'continueWithApple'
  | 'continueAsGuest'
  | 'daysPerWeekQuestion'
  | 'sessionLengthQuestion'
  | 'insertExample'
  | 'clear'
  | 'noDraftFound'
  | 'noExercisesYet'
  | 'addExerciseCta'
  | 'cycleLengthTitle'
  | 'weeklySchedule'
  | 'trainingDaysLabel'
  | 'sessionLengthLabel'
  | 'totalExercisesLabel'
  | 'perWeekSuffix'
  | 'minutesShort'
  | 'createWorkoutWithAi'
  | 'instructions'
  | 'instructionsSubtitle'
  | 'createCycle'
  | 'copy'
  | 'aiTrainer'
  | 'aiTrainerSubtitle'
  | 'conversationSummary'
  | 'aiIsSpeaking'
  | 'processingResponse'
  | 'listening'
  | 'schedule'
  | 'workoutNotFound'
  | 'skipped'
  | 'cycleNotFound'
  | 'createCycleToSeeWorkouts'
  | 'noExercisesAddedYet'
  | 'noLoggedDataThisWeek'
  | 'errorNoWorkoutsFound'
  | 'failedToCreateCycle'
  | 'completeWorkoutTitle'
  | 'completeWorkoutMessage'
  | 'reactivateExerciseTitle'
  | 'reactivateExerciseMessage'
  | 'reactivate'
  | 'trainerLabel'
  | 'youLabel'
  | 'permissionRequired'
  | 'notificationPermissionTitle'
  | 'notificationPermissionBody'
  | 'enableNotifications'
  | 'notNow'
  | 'openSettings'
  | 'timerNotifications'
  | 'timerNotificationsDescription'
  | 'notificationUnavailable'
  | 'notificationSystemDisabled'
  | 'currentStreak'
  | 'viewAll'
  | 'photoLibraryPermissionTitle'
  | 'photoLibraryPermissionBody'
  | 'imagePickerUnavailable'
  | 'audioPermissionRequired'
  | 'errorFailedStartRecording'
  | 'errorFailedGetRecordingUri'
  | 'apiKeyRequired'
  | 'apiKeyRequiredMessage'
  | 'transcriptionErrorTitle'
  | 'transcriptionErrorMessage'
  | 'errorFailedProcessRecording'
  | 'designSystemTitle'
  | 'colorsTitle'
  | 'spacingTitle'
  | 'typographyTitle'
  | 'borderRadiusTitle'
  | 'componentsTitle'
  | 'buttonsTitle'
  | 'primaryButton'
  | 'withIconLeft'
  | 'withIconRight'
  | 'primaryButtonNoLabel'
  | 'secondaryButton'
  | 'textButton'
  | 'iconsTitle'
  | 'iconAdd'
  | 'iconCheck'
  | 'iconPlay'
  | 'iconPause'
  | 'iconEdit'
  | 'iconTrash'
  | 'iconCalendar'
  | 'iconWorkouts'
  | 'iconUser'
  | 'iconArrow'
  | 'cardsTitle'
  | 'basicCard'
  | 'cardWithDualShadows'
  | 'done'
  | 'editExerciseTitle'
  | 'exerciseNameLabel'
  | 'setsLabel'
  | 'repsLabel'
  | 'restSecondsLabel'
  | 'notesOptional'
  | 'movementLabel'
  | 'equipmentLabel'
  | 'editWorkoutTitle'
  | 'workoutNameLabel'
  | 'typeLabel'
  | 'assignToDayOptional'
  | 'editExercisesCta'
  | 'deleteWorkout'
  | 'deleteWorkoutMessage'
  | 'createCycleTitle'
  | 'stepOf'
  | 'goalQuestion'
  | 'goalDescription'
  | 'durationQuestion'
  | 'durationDescription'
  | 'newCycleButton'
  | 'noCyclesYet'
  | 'noCyclesYetSubtext'
  | 'activeBadge'
  | 'completeBadge'
  | 'perWeekLabel'
  | 'workoutsCountLabel'
  | 'trainingFrequencyTitle'
  | 'daysPerWeekLabel'
  | 'goalPlaceholder'
  | 'endDateLabel'
  | 'next'
  | 'searchExercisesPlaceholder'
  | 'trainerName'
  | 'trainerFormatInstructions'
  | 'trainerExampleTitle'
  | 'trainerExampleBody'
  | 'trainerAiPlaceholder'
  | 'trainerManualPlaceholder'
  | 'trainerCreatingCycle'
  | 'trainerPreview'
  | 'trainerSaveCycle'
  | 'trainerStartOver'
  | 'noExercisesFound'
  | 'customBadge'
  | 'barbellLabel'
  | 'all'
  | 'workoutStats'
  | 'totalWorkouts'
  | 'thisMonth'
  | 'bodyWeight'
  | 'noWeightEntriesYet'
  | 'exitSetupTitle'
  | 'exitSetupMessage'
  | 'exit'
  | 'startDateRequiredTitle'
  | 'startDateRequiredMessage'
  | 'unsavedChangesTitle'
  | 'unsavedChangesMessage'
  | 'discard'
  | 'failedToSaveChanges'
  | 'listOfExercises'
  | 'applyChangesTitle'
  | 'thisWorkoutOnly'
  | 'allFutureWorkouts'
  | 'setsUnit'
  | 'addFiveSeconds'
  | 'weekCycleSingular'
  | 'weekCyclePlural'
  | 'workoutNameRequired'
  | 'failedToExportData'
  | 'timerNameRequired'
  | 'historyClearedTitle'
  | 'historyClearedMessage'
  | 'resetOnboardingFailed'
  | 'pasteAiWorkoutPlaceholder'
  | 'customTemplatePlaceholder'
  | 'swapWorkout'
  | 'userInitial'
  | 'weekLabel'
  | 'weekWithDate'
  | 'cycleWeekLabel'
  | 'noOtherDaysThisWeek'
  | 'dayNumber'
  | 'weekShort'
  | 'reps'
  | 'deleteCycleTitle'
  | 'deleteCycleMessage'
  | 'cycleDataTitle'
  | 'exportData'
  | 'copiedTitle'
  | 'templateCopied'
  | 'enterWorkoutDetails'
  | 'trainerQuestionGreeting'
  | 'trainerQuestionExperience'
  | 'listeningToTrainer'
  | 'tapToAnswer'
  | 'trainerFinalMessage'
  | 'resetProgressTitle'
  | 'resetProgressMessage'
  | 'profile'
  | 'settings'
  | 'language'
  | 'english'
  | 'spanish'
  | 'useKilograms'
  | 'weightsShownInKg'
  | 'weightsShownInLb'
  | 'defaultRestTime'
  | 'betweenSets'
  | 'monthlyProgressCheck'
  | 'monthlyProgressReminder'
  | 'designSystem'
  | 'viewDesignSystem'
  | 'clearAllHistory'
  | 'clearAllHistoryDescription'
  | 'resetOnboarding'
  | 'resetOnboardingDescription'
  | 'addWeightEntry'
  | 'weightPlaceholder'
  | 'cancel'
  | 'add';

const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  en: {
    today: 'Today',
    workouts: 'Workouts',
    noWorkoutsYet: 'No workouts yet',
    goToWorkouts: 'Go to Workouts',
    start: 'Start',
    resume: 'Resume',
    edit: 'Edit',
    restDayTitle: 'This is your rest day',
    noWorkoutsScheduled: 'No workouts scheduled',
    swap: 'Swap',
    createWorkout: 'Create Workout',
    addWorkout: 'Add Workout',
    addIntervalTimer: 'Add interval timer',
    addInterval: 'Add',
    new: 'New',
    inProgress: 'In progress',
    currentCycle: 'Current Cycle',
    pastCycles: 'Past Cycles',
    cycleNumber: 'Cycle {number}',
    seeDetails: 'See details',
    newCycle: 'New Cycle',
    saveAndCreate: 'Save and Create',
    questionCreateWorkoutLine1: 'How do you want to',
    questionCreateWorkoutLine2: 'create a new workout?',
    manually: 'Manually',
    withAiHelp: 'With AI help',
    from: 'from ',
    to: 'to ',
    saveChanges: 'Save changes',
    markAsDone: 'Mark as Done',
    history: 'History',
    reset: 'Reset',
    complete: 'Complete',
    skip: 'Skip',
    noHistoryRecordedYet: 'No history recorded yet',
    alertCompleteExerciseTitle: 'Complete Exercise',
    alertCompleteExerciseMessage: 'Mark all sets as complete?',
    alertResetExerciseTitle: 'Reset Exercise',
    alertResetExerciseMessage: 'Clear all progress for this exercise? This cannot be undone.',
    alertSkipExerciseTitle: 'Skip Exercise',
    alertSkipExerciseMessage: 'Are you sure you want to skip this exercise?',
    alertErrorTitle: 'Error',
    alertSkipFailed: 'Failed to skip exercise. Please try again.',
    alertMissingWorkoutInfo: 'Missing workout or exercise information',
    createCycle: 'Create cycle',
    trainingDays: 'Training days',
    cycleLength: 'Cycle length',
    weeks: 'weeks',
    buildYourWeek: 'Build your week',
    addExercises: 'Add exercises',
    back: 'Back',
    exercises: 'Exercises',
    addExercise: 'Add exercise',
    saveDay: 'Save day',
    addExerciseTitle: 'Add Exercise',
    reviewCycle: 'Review cycle',
    cycleSummary: 'Cycle Summary',
    startDate: 'Start date',
    workoutsLabel: 'Workouts',
    editLabel: 'Edit',
    newWorkout: 'New Workout',
    continue: 'Continue',
    deleteExerciseTitle: 'Delete Exercise',
    deleteExerciseMessage: 'Are you sure you want to remove this exercise?',
    delete: 'Delete',
    unknownExercise: 'Unknown Exercise',
    exercise: 'Exercise',
    round: 'Round',
    moveFor: 'Move for',
    restAfterEachExercise: 'Rest after each exercise',
    exercisesInRound: 'Exercises in a round',
    roundsLabel: 'Rounds',
    restBetweenRounds: 'Rest between rounds',
    save: 'Save',
    createTimer: 'Create Timer',
    savedTimers: 'Saved timers',
    setLabel: 'Set',
    roundLabel: 'Round',
    go: 'Go!',
    timerCompleteTitle: 'Timer complete',
    timerCompleteBody: '{exerciseName} is done',
    workoutComplete: 'Workout complete',
    niceWork: 'Nice work',
    nextSetOutOf: 'Next set {current} out of {total}',
    setOf: 'Set {current} of {total}',
    timerName: 'Timer name',
    saveAndReset: 'Save & Reset',
    welcomeTitle: 'Welcome to\nWorkout Tracker',
    continueWithApple: 'Continue with Apple',
    continueAsGuest: 'Continue as guest',
    daysPerWeekQuestion: 'How many days per week can you train?',
    sessionLengthQuestion: 'How long is each session?',
    insertExample: 'Insert example',
    clear: 'Clear',
    noDraftFound: 'No draft found',
    noExercisesYet: 'No exercises yet. Add some below!',
    addExerciseCta: '+ Add exercise',
    cycleLengthTitle: 'Cycle Length',
    weeklySchedule: 'Weekly Schedule',
    trainingDaysLabel: 'Training days:',
    sessionLengthLabel: 'Session length:',
    totalExercisesLabel: 'Total exercises:',
    perWeekSuffix: '/week',
    minutesShort: 'min',
    createWorkoutWithAi: 'Create Workout with AI',
    instructions: 'Instructions',
    instructionsSubtitle: 'Ask your agent to use the following template:',
    copy: 'Copy',
    aiTrainer: 'AI Trainer',
    aiTrainerSubtitle: "Let's create your perfect training cycle",
    conversationSummary: 'Conversation Summary',
    aiIsSpeaking: 'AI is speaking...',
    processingResponse: 'Processing your response...',
    listening: 'Listening...',
    schedule: 'Schedule',
    workoutNotFound: 'Workout not found',
    skipped: 'Skipped',
    cycleNotFound: 'Cycle not found',
    createCycleToSeeWorkouts: 'Create a cycle to see workouts',
    noExercisesAddedYet: 'No exercises added yet',
    noLoggedDataThisWeek: 'No logged data for this week',
    errorNoWorkoutsFound: 'No workouts found in the input. Please check the format.',
    failedToCreateCycle: 'Failed to create cycle. Please try again.',
    reps: 'reps',
    completeWorkoutTitle: 'Complete Workout',
    completeWorkoutMessage: 'Mark all exercises and sets as complete?',
    reactivateExerciseTitle: 'Reactivate Exercise',
    reactivateExerciseMessage: 'Do you want to reactivate {name}?',
    reactivate: 'Reactivate',
    trainerLabel: 'Trainer',
    youLabel: 'You',
    permissionRequired: 'Permission Required',
    notificationPermissionTitle: 'Enable notifications',
    notificationPermissionBody: 'Get an alert when your timer finishes in the background.',
    enableNotifications: 'Enable',
    notNow: 'Not now',
    openSettings: 'Open Settings',
    timerNotifications: 'Timer notifications',
    timerNotificationsDescription: 'Alerts when timers finish in the background.',
    notificationUnavailable: 'Notifications are unavailable on this device.',
    notificationSystemDisabled: 'Disabled in system settings.',
    currentStreak: 'Current streak',
    viewAll: 'View all',
    photoLibraryPermissionTitle: 'Allow photo access',
    photoLibraryPermissionBody: 'Enable photo access to upload your profile picture.',
    imagePickerUnavailable: 'Photo picker is unavailable on this device.',
    audioPermissionRequired: 'Audio recording permission is required to use the trainer.',
    errorFailedStartRecording: 'Failed to start recording',
    errorFailedGetRecordingUri: 'Failed to get recording URI',
    apiKeyRequired: 'API Key Required',
    apiKeyRequiredMessage: 'Please add your OpenAI API key in the Profile settings to use voice transcription.',
    transcriptionErrorTitle: 'Transcription Error',
    transcriptionErrorMessage: 'Failed to transcribe audio. Please try again.',
    errorFailedProcessRecording: 'Failed to process recording',
    designSystemTitle: 'Design System',
    colorsTitle: 'Colors',
    spacingTitle: 'Spacing',
    typographyTitle: 'Typography',
    borderRadiusTitle: 'Border Radius',
    componentsTitle: 'Components',
    buttonsTitle: 'Buttons',
    primaryButton: 'Primary Button',
    withIconLeft: 'With Icon Left',
    withIconRight: 'With Icon Right',
    primaryButtonNoLabel: 'Primary Button No Label',
    secondaryButton: 'Secondary Button',
    textButton: 'Text Button',
    iconsTitle: 'Icons',
    iconAdd: 'Add',
    iconCheck: 'Check',
    iconPlay: 'Play',
    iconPause: 'Pause',
    iconEdit: 'Edit',
    iconTrash: 'Trash',
    iconCalendar: 'Calendar',
    iconWorkouts: 'Workouts',
    iconUser: 'User',
    iconArrow: 'Arrow',
    cardsTitle: 'Cards',
    basicCard: 'Basic Card',
    cardWithDualShadows: 'Card with Dual Shadows',
    done: 'Done',
    editExerciseTitle: 'Edit Exercise',
    exerciseNameLabel: 'Exercise Name',
    setsLabel: 'Sets',
    repsLabel: 'Reps',
    restSecondsLabel: 'Rest (seconds)',
    notesOptional: 'Notes (optional)',
    movementLabel: 'Movement:',
    equipmentLabel: 'Equipment:',
    editWorkoutTitle: 'Edit Workout',
    workoutNameLabel: 'Workout Name',
    typeLabel: 'Type',
    assignToDayOptional: 'Assign to Day (optional)',
    editExercisesCta: 'Edit Exercises →',
    deleteWorkout: 'Delete Workout',
    deleteWorkoutMessage: 'Are you sure you want to delete this workout?',
    createCycleTitle: 'Create Cycle {number}',
    stepOf: 'Step {step} of {total}',
    goalQuestion: "What's your goal?",
    goalDescription: 'Describe what you want to achieve',
    durationQuestion: 'How long?',
    durationDescription: 'Choose cycle duration',
    newCycleButton: 'New Cycle',
    noCyclesYet: 'No cycles yet',
    noCyclesYetSubtext: 'Tap "New Cycle" to create your first training cycle',
    activeBadge: 'ACTIVE',
    completeBadge: 'COMPLETE',
    perWeekLabel: 'per week',
    workoutsCountLabel: 'workouts',
    trainingFrequencyTitle: 'Training frequency?',
    daysPerWeekLabel: 'Days per week',
    goalPlaceholder: 'e.g., Build strength, lose weight, gain muscle...',
    endDateLabel: 'Ends {date}',
    next: 'Next',
    searchExercisesPlaceholder: 'Search exercises...',
    trainerName: 'Kaio Sama',
    trainerFormatInstructions: 'Format: Week [number]\n[Workout Type]: [Workout Name]\n- Exercise name: sets x reps @ weight',
    trainerExampleTitle: 'Example:',
    trainerExampleBody:
      'Week 8\n\nPush: Push A\n- Bench Press: 4 x 6-8 @ 50kg\n- Overhead Press: 3 x 8-10 @ 35kg\n\nPull: Pull A\n- Deadlift: 4 x 5-6 @ 80kg\n- Pull-ups: 3 x 8-10 @ 0kg\n\n(Week number = cycle duration in weeks)',
    trainerAiPlaceholder:
      "E.g., Create a 6-week push/pull/legs program focused on hypertrophy. I'm intermediate level and want to train 4 days per week.",
    trainerManualPlaceholder:
      'Week 8\n\nPush: Push A\n- Bench Press: 4 x 6-8 @ 50kg\n- Overhead Press: 3 x 8-10 @ 35kg\n\nPull: Pull A\n- Deadlift: 4 x 5-6 @ 80kg',
    trainerCreatingCycle: 'Creating your cycle...',
    trainerPreview: 'Preview',
    trainerSaveCycle: 'Save Cycle',
    trainerStartOver: 'Start Over',
    noExercisesFound: 'No exercises found',
    customBadge: 'CUSTOM',
    barbellLabel: 'Barbell',
    all: 'All',
    workoutStats: 'Workout Stats',
    totalWorkouts: 'Total Workouts',
    thisMonth: 'This Month',
    bodyWeight: 'Body Weight',
    noWeightEntriesYet: 'No weight entries yet',
    exitSetupTitle: 'Exit setup?',
    exitSetupMessage: "Your progress won't be saved.",
    exit: 'Exit',
    startDateRequiredTitle: 'Start Date Required',
    startDateRequiredMessage: 'Please select a start date for your cycle.',
    unsavedChangesTitle: 'Unsaved Changes',
    unsavedChangesMessage: 'You have unsaved changes. Do you want to discard them?',
    discard: 'Discard',
    failedToSaveChanges: 'Failed to save changes. Please try again.',
    listOfExercises: 'List of Exercises',
    applyChangesTitle: 'Apply Changes',
    thisWorkoutOnly: 'This Workout Only',
    allFutureWorkouts: 'All Future Workouts',
    setsUnit: 'sets',
    addFiveSeconds: '+5',
    weekCycleSingular: '1-week Cycle',
    weekCyclePlural: '{weeks}-weeks Cycle',
    workoutNameRequired: 'Please enter a workout name',
    failedToExportData: 'Failed to export data',
    timerNameRequired: 'Please enter a name for the timer',
    historyClearedTitle: 'History Cleared',
    historyClearedMessage: 'All workout history has been deleted.',
    resetOnboardingFailed: 'Failed to reset onboarding.',
    pasteAiWorkoutPlaceholder: 'Paste the AI-generated workout here',
    customTemplatePlaceholder: 'Day 1: Push\nBench Press - 4x5\nIncline Press - 3x8\n...',
    swapWorkout: 'Swap Workout',
    userInitial: 'U',
    weekLabel: 'Week {number}',
    weekWithDate: 'Week {number} — {date}',
    cycleWeekLabel: 'Cycle {cycle} — Week {week}',
    noOtherDaysThisWeek: 'No other days this week to swap with',
    dayNumber: 'Day {number}',
    weekShort: 'W{number}',
    deleteCycleTitle: 'Delete Cycle',
    deleteCycleMessage: 'Are you sure you want to delete Cycle {number}? This action cannot be undone.',
    cycleDataTitle: 'Cycle {number} Data',
    exportData: 'Export Data',
    copiedTitle: 'Copied',
    templateCopied: 'Template copied to clipboard',
    enterWorkoutDetails: 'Please enter workout details',
    trainerQuestionGreeting: "What's your main goal right now?",
    trainerQuestionExperience: 'How long have you been training consistently?',
    listeningToTrainer: 'Listening to trainer...',
    tapToAnswer: 'Tap to answer',
    trainerFinalMessage: "Great! Based on your goals and experience, I'll help you create a personalized training cycle. Let's build something amazing together!",
    resetProgressTitle: 'Reset Progress',
    resetProgressMessage: 'Clear all progress for this workout? This cannot be undone.',
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
    useKilograms: 'Use Kilograms',
    weightsShownInKg: 'Weights shown in kg',
    weightsShownInLb: 'Weights shown in lb',
    defaultRestTime: 'Default Rest Time',
    betweenSets: 'between sets',
    monthlyProgressCheck: 'Monthly Progress Check',
    monthlyProgressReminder: 'Reminder on day {day} of each month',
    designSystem: 'Design System',
    viewDesignSystem: 'View colors, typography, and components',
    clearAllHistory: 'Clear All History',
    clearAllHistoryDescription: 'Delete all workout records and progress',
    resetOnboarding: 'Reset Onboarding',
    resetOnboardingDescription: 'Return to welcome screen for testing',
    addWeightEntry: 'Add Weight Entry',
    weightPlaceholder: 'Weight ({unit})',
    cancel: 'Cancel',
    add: 'Add',
  },
  es: {
    today: 'Hoy',
    workouts: 'Entrenamientos',
    noWorkoutsYet: 'No hay entrenamientos',
    goToWorkouts: 'Ir a Entrenamientos',
    start: 'Empezar',
    resume: 'Reanudar',
    edit: 'Editar',
    restDayTitle: 'Es tu dia de descanso',
    noWorkoutsScheduled: 'No hay entrenamientos',
    swap: 'Cambiar',
    createWorkout: 'Crear entrenamiento',
    addWorkout: 'Agregar entrenamiento',
    addIntervalTimer: 'Agregar temporizador',
    addInterval: 'Agregar',
    new: 'Nuevo',
    inProgress: 'En progreso',
    currentCycle: 'Ciclo actual',
    pastCycles: 'Ciclos pasados',
    cycleNumber: 'Ciclo {number}',
    seeDetails: 'Ver detalles',
    newCycle: 'Nuevo ciclo',
    saveAndCreate: 'Guardar y crear',
    questionCreateWorkoutLine1: 'Como quieres',
    questionCreateWorkoutLine2: 'crear un entrenamiento?',
    manually: 'Manual',
    withAiHelp: 'Con ayuda de IA',
    from: 'desde ',
    to: 'hasta ',
    saveChanges: 'Guardar cambios',
    markAsDone: 'Marcar como hecho',
    history: 'Historial',
    reset: 'Reiniciar',
    complete: 'Completar',
    skip: 'Omitir',
    noHistoryRecordedYet: 'Sin historial',
    alertCompleteExerciseTitle: 'Completar ejercicio',
    alertCompleteExerciseMessage: 'Marcar todas las series como completas?',
    alertResetExerciseTitle: 'Reiniciar ejercicio',
    alertResetExerciseMessage: 'Borrar todo el progreso? No se puede deshacer.',
    alertSkipExerciseTitle: 'Omitir ejercicio',
    alertSkipExerciseMessage: 'Seguro que quieres omitir este ejercicio?',
    alertErrorTitle: 'Error',
    alertSkipFailed: 'No se pudo omitir. Intenta de nuevo.',
    alertMissingWorkoutInfo: 'Falta informacion del entrenamiento',
    createCycle: 'Crear ciclo',
    trainingDays: 'Dias de entrenamiento',
    cycleLength: 'Duracion del ciclo',
    weeks: 'semanas',
    buildYourWeek: 'Construye tu semana',
    addExercises: 'Agregar ejercicios',
    back: 'Atras',
    exercises: 'Ejercicios',
    addExercise: 'Agregar ejercicio',
    saveDay: 'Guardar dia',
    addExerciseTitle: 'Agregar ejercicio',
    reviewCycle: 'Revisar ciclo',
    cycleSummary: 'Resumen del ciclo',
    startDate: 'Fecha de inicio',
    workoutsLabel: 'Entrenamientos',
    editLabel: 'Editar',
    newWorkout: 'Nuevo entrenamiento',
    continue: 'Continuar',
    deleteExerciseTitle: 'Eliminar ejercicio',
    deleteExerciseMessage: 'Seguro que quieres eliminar este ejercicio?',
    delete: 'Eliminar',
    unknownExercise: 'Ejercicio desconocido',
    exercise: 'Ejercicio',
    round: 'Ronda',
    moveFor: 'Mover por',
    restAfterEachExercise: 'Descanso despues de cada ejercicio',
    exercisesInRound: 'Ejercicios en una ronda',
    roundsLabel: 'Rondas',
    restBetweenRounds: 'Descanso entre rondas',
    save: 'Guardar',
    createTimer: 'Crear temporizador',
    savedTimers: 'Temporizadores guardados',
    setLabel: 'Serie',
    roundLabel: 'Ronda',
    go: 'Ya!',
    timerCompleteTitle: 'Temporizador completo',
    timerCompleteBody: '{exerciseName} terminó',
    workoutComplete: 'Entrenamiento completo',
    niceWork: 'Buen trabajo',
    nextSetOutOf: 'Siguiente serie {current} de {total}',
    setOf: 'Serie {current} de {total}',
    timerName: 'Nombre del temporizador',
    saveAndReset: 'Guardar y reiniciar',
    welcomeTitle: 'Bienvenido a\nWorkout Tracker',
    continueWithApple: 'Continuar con Apple',
    continueAsGuest: 'Continuar como invitado',
    daysPerWeekQuestion: 'Cuantos dias por semana puedes entrenar?',
    sessionLengthQuestion: 'Cuanto dura cada sesion?',
    insertExample: 'Insertar ejemplo',
    clear: 'Borrar',
    noDraftFound: 'No hay borrador',
    noExercisesYet: 'No hay ejercicios. Agrega abajo.',
    addExerciseCta: '+ Agregar ejercicio',
    cycleLengthTitle: 'Duracion del ciclo',
    weeklySchedule: 'Horario semanal',
    trainingDaysLabel: 'Dias de entrenamiento:',
    sessionLengthLabel: 'Duracion de la sesion:',
    totalExercisesLabel: 'Total de ejercicios:',
    perWeekSuffix: '/semana',
    minutesShort: 'min',
    createWorkoutWithAi: 'Crear entrenamiento con IA',
    instructions: 'Instrucciones',
    instructionsSubtitle: 'Pide a tu agente que use la siguiente plantilla:',
    copy: 'Copiar',
    aiTrainer: 'Entrenador IA',
    aiTrainerSubtitle: 'Creemos tu ciclo perfecto',
    conversationSummary: 'Resumen de conversacion',
    aiIsSpeaking: 'IA esta hablando...',
    processingResponse: 'Procesando tu respuesta...',
    listening: 'Escuchando...',
    schedule: 'Calendario',
    workoutNotFound: 'Entrenamiento no encontrado',
    skipped: 'Omitido',
    cycleNotFound: 'Ciclo no encontrado',
    createCycleToSeeWorkouts: 'Crea un ciclo para ver entrenamientos',
    noExercisesAddedYet: 'No hay ejercicios agregados',
    noLoggedDataThisWeek: 'Sin datos registrados esta semana',
    errorNoWorkoutsFound: 'No se encontraron entrenamientos. Revisa el formato.',
    failedToCreateCycle: 'No se pudo crear el ciclo. Intenta de nuevo.',
    reps: 'reps',
    completeWorkoutTitle: 'Completar entrenamiento',
    completeWorkoutMessage: 'Marcar todos los ejercicios y series como completos?',
    reactivateExerciseTitle: 'Reactivar ejercicio',
    reactivateExerciseMessage: 'Quieres reactivar {name}?',
    reactivate: 'Reactivar',
    trainerLabel: 'Entrenador',
    youLabel: 'Tu',
    permissionRequired: 'Permiso requerido',
    notificationPermissionTitle: 'Habilitar notificaciones',
    notificationPermissionBody: 'Recibe una alerta cuando tu temporizador termine en segundo plano.',
    enableNotifications: 'Habilitar',
    notNow: 'Ahora no',
    openSettings: 'Abrir ajustes',
    timerNotifications: 'Notificaciones de temporizador',
    timerNotificationsDescription: 'Alertas cuando el temporizador termina en segundo plano.',
    notificationUnavailable: 'Las notificaciones no estan disponibles en este dispositivo.',
    notificationSystemDisabled: 'Desactivadas en los ajustes del sistema.',
    currentStreak: 'Racha actual',
    viewAll: 'Ver todo',
    photoLibraryPermissionTitle: 'Permitir acceso a fotos',
    photoLibraryPermissionBody: 'Habilita el acceso a fotos para subir tu imagen de perfil.',
    imagePickerUnavailable: 'El selector de fotos no esta disponible en este dispositivo.',
    audioPermissionRequired: 'Se requiere permiso de audio para usar el entrenador.',
    errorFailedStartRecording: 'No se pudo iniciar la grabacion',
    errorFailedGetRecordingUri: 'No se pudo obtener el audio',
    apiKeyRequired: 'API Key requerida',
    apiKeyRequiredMessage: 'Agrega tu API key de OpenAI en Perfil para transcripcion.',
    transcriptionErrorTitle: 'Error de transcripcion',
    transcriptionErrorMessage: 'No se pudo transcribir. Intenta de nuevo.',
    errorFailedProcessRecording: 'No se pudo procesar la grabacion',
    designSystemTitle: 'Sistema de diseno',
    colorsTitle: 'Colores',
    spacingTitle: 'Espaciado',
    typographyTitle: 'Tipografia',
    borderRadiusTitle: 'Radio de borde',
    componentsTitle: 'Componentes',
    buttonsTitle: 'Botones',
    primaryButton: 'Boton primario',
    withIconLeft: 'Con icono a la izquierda',
    withIconRight: 'Con icono a la derecha',
    primaryButtonNoLabel: 'Boton primario sin etiqueta',
    secondaryButton: 'Boton secundario',
    textButton: 'Boton de texto',
    iconsTitle: 'Iconos',
    iconAdd: 'Agregar',
    iconCheck: 'Check',
    iconPlay: 'Play',
    iconPause: 'Pause',
    iconEdit: 'Editar',
    iconTrash: 'Eliminar',
    iconCalendar: 'Calendario',
    iconWorkouts: 'Entrenamientos',
    iconUser: 'Usuario',
    iconArrow: 'Flecha',
    cardsTitle: 'Tarjetas',
    basicCard: 'Tarjeta basica',
    cardWithDualShadows: 'Tarjeta con doble sombra',
    done: 'Listo',
    editExerciseTitle: 'Editar ejercicio',
    exerciseNameLabel: 'Nombre del ejercicio',
    setsLabel: 'Series',
    repsLabel: 'Reps',
    restSecondsLabel: 'Descanso (segundos)',
    notesOptional: 'Notas (opcional)',
    movementLabel: 'Movimiento:',
    equipmentLabel: 'Equipo:',
    editWorkoutTitle: 'Editar entrenamiento',
    workoutNameLabel: 'Nombre del entrenamiento',
    typeLabel: 'Tipo',
    assignToDayOptional: 'Asignar al dia (opcional)',
    editExercisesCta: 'Editar ejercicios →',
    deleteWorkout: 'Eliminar entrenamiento',
    deleteWorkoutMessage: 'Seguro que quieres eliminar este entrenamiento?',
    createCycleTitle: 'Crear ciclo {number}',
    stepOf: 'Paso {step} de {total}',
    goalQuestion: 'Cual es tu objetivo?',
    goalDescription: 'Describe lo que quieres lograr',
    durationQuestion: 'Cuanto tiempo?',
    durationDescription: 'Elige la duracion del ciclo',
    newCycleButton: 'Nuevo ciclo',
    noCyclesYet: 'No hay ciclos',
    noCyclesYetSubtext: 'Toca "Nuevo ciclo" para crear tu primer ciclo',
    activeBadge: 'ACTIVO',
    completeBadge: 'COMPLETO',
    perWeekLabel: 'por semana',
    workoutsCountLabel: 'entrenamientos',
    trainingFrequencyTitle: 'Frecuencia de entrenamiento?',
    daysPerWeekLabel: 'Dias por semana',
    goalPlaceholder: 'Ej: ganar fuerza, perder peso, ganar musculo...',
    endDateLabel: 'Termina {date}',
    next: 'Siguiente',
    searchExercisesPlaceholder: 'Buscar ejercicios...',
    trainerName: 'Kaio Sama',
    trainerFormatInstructions:
      'Formato: Semana [numero]\n[Tipo de entrenamiento]: [Nombre del entrenamiento]\n- Ejercicio: series x reps @ peso',
    trainerExampleTitle: 'Ejemplo:',
    trainerExampleBody:
      'Semana 8\n\nPush: Push A\n- Bench Press: 4 x 6-8 @ 50kg\n- Overhead Press: 3 x 8-10 @ 35kg\n\nPull: Pull A\n- Deadlift: 4 x 5-6 @ 80kg\n- Pull-ups: 3 x 8-10 @ 0kg\n\n(Numero de semana = duracion del ciclo en semanas)',
    trainerAiPlaceholder:
      'Ej: Crea un programa de 6 semanas push/pull/legs enfocado en hipertrofia. Soy intermedio y quiero entrenar 4 dias por semana.',
    trainerManualPlaceholder:
      'Semana 8\n\nPush: Push A\n- Bench Press: 4 x 6-8 @ 50kg\n- Overhead Press: 3 x 8-10 @ 35kg\n\nPull: Pull A\n- Deadlift: 4 x 5-6 @ 80kg',
    trainerCreatingCycle: 'Creando tu ciclo...',
    trainerPreview: 'Vista previa',
    trainerSaveCycle: 'Guardar ciclo',
    trainerStartOver: 'Empezar de nuevo',
    noExercisesFound: 'No se encontraron ejercicios',
    customBadge: 'PERSONAL',
    barbellLabel: 'Barra',
    all: 'Todo',
    workoutStats: 'Estadisticas de entrenamiento',
    totalWorkouts: 'Entrenamientos totales',
    thisMonth: 'Este mes',
    bodyWeight: 'Peso corporal',
    noWeightEntriesYet: 'No hay registros de peso',
    exitSetupTitle: 'Salir de la configuracion?',
    exitSetupMessage: 'No se guardara tu progreso.',
    exit: 'Salir',
    startDateRequiredTitle: 'Fecha de inicio requerida',
    startDateRequiredMessage: 'Selecciona una fecha de inicio para tu ciclo.',
    unsavedChangesTitle: 'Cambios sin guardar',
    unsavedChangesMessage: 'Tienes cambios sin guardar. Deseas descartarlos?',
    discard: 'Descartar',
    failedToSaveChanges: 'No se pudieron guardar los cambios. Intenta de nuevo.',
    listOfExercises: 'Lista de ejercicios',
    applyChangesTitle: 'Aplicar cambios',
    thisWorkoutOnly: 'Solo este entrenamiento',
    allFutureWorkouts: 'Todos los futuros entrenamientos',
    setsUnit: 'series',
    addFiveSeconds: '+5',
    weekCycleSingular: 'Ciclo de 1 semana',
    weekCyclePlural: 'Ciclo de {weeks} semanas',
    workoutNameRequired: 'Ingresa un nombre del entrenamiento',
    failedToExportData: 'No se pudo exportar',
    timerNameRequired: 'Ingresa un nombre para el temporizador',
    historyClearedTitle: 'Historial borrado',
    historyClearedMessage: 'Se elimino todo el historial de entrenamientos.',
    resetOnboardingFailed: 'No se pudo reiniciar el onboarding.',
    pasteAiWorkoutPlaceholder: 'Pega el entrenamiento generado por IA aqui',
    customTemplatePlaceholder: 'Dia 1: Push\nBench Press - 4x5\nIncline Press - 3x8\n...',
    swapWorkout: 'Cambiar entrenamiento',
    userInitial: 'U',
    weekLabel: 'Semana {number}',
    weekWithDate: 'Semana {number} — {date}',
    cycleWeekLabel: 'Ciclo {cycle} — Semana {week}',
    noOtherDaysThisWeek: 'No hay otros dias esta semana para cambiar',
    dayNumber: 'Dia {number}',
    weekShort: 'S{number}',
    deleteCycleTitle: 'Eliminar ciclo',
    deleteCycleMessage: 'Seguro que quieres eliminar el ciclo {number}? Esta accion no se puede deshacer.',
    cycleDataTitle: 'Datos del ciclo {number}',
    exportData: 'Exportar datos',
    copiedTitle: 'Copiado',
    templateCopied: 'Plantilla copiada al portapapeles',
    enterWorkoutDetails: 'Ingresa los detalles del entrenamiento',
    trainerQuestionGreeting: 'Cual es tu objetivo principal ahora?',
    trainerQuestionExperience: 'Cuanto tiempo llevas entrenando?',
    listeningToTrainer: 'Escuchando al entrenador...',
    tapToAnswer: 'Toca para responder',
    trainerFinalMessage: 'Genial! Con tus objetivos y experiencia, te ayudare a crear un ciclo personalizado. Construyamos algo genial!',
    resetProgressTitle: 'Reiniciar progreso',
    resetProgressMessage: 'Borrar todo el progreso? No se puede deshacer.',
    profile: 'Perfil',
    settings: 'Configuracion',
    language: 'Idioma',
    english: 'Ingles',
    spanish: 'Espanol',
    useKilograms: 'Usar kilogramos',
    weightsShownInKg: 'Pesos en kg',
    weightsShownInLb: 'Pesos en lb',
    defaultRestTime: 'Descanso por defecto',
    betweenSets: 'entre series',
    monthlyProgressCheck: 'Revision mensual',
    monthlyProgressReminder: 'Recordatorio el dia {day} de cada mes',
    designSystem: 'Sistema de diseno',
    viewDesignSystem: 'Ver colores, tipografia y componentes',
    clearAllHistory: 'Borrar historial',
    clearAllHistoryDescription: 'Eliminar registros y progreso',
    resetOnboarding: 'Reiniciar inicio',
    resetOnboardingDescription: 'Volver a la pantalla inicial',
    addWeightEntry: 'Agregar peso',
    weightPlaceholder: 'Peso ({unit})',
    cancel: 'Cancelar',
    add: 'Agregar',
  },
};

export const t = (key: TranslationKey, language: Language = DEFAULT_LANGUAGE): string =>
  TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
