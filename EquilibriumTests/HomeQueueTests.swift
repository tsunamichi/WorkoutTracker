import XCTest
@testable import Equilibrium

@MainActor
final class HomeQueueTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "America/New_York")!
        return value
    }

    private func date(_ day: Int, hour: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: day, hour: hour))!
    }

    private func ready(_ id: String, createdAt: Date) -> Workout {
        var value = EquilibriumFixtures.ready(id: id)
        value.createdAt = createdAt; value.updatedAt = createdAt
        return value
    }

    private func inProgress(_ id: String, createdAt: Date) -> Workout {
        var value = EquilibriumFixtures.inProgress(id: id)
        value.createdAt = createdAt; value.updatedAt = createdAt
        return value
    }

    private func completed(_ id: String, createdAt: Date, completedAt: Date) -> Workout {
        var value = EquilibriumFixtures.completed(id: id)
        value.createdAt = createdAt; value.completedAt = completedAt; value.updatedAt = completedAt
        return value
    }

    func testLoadFailureKeepsVisibleWorkoutsAndSuccessfulRetryClearsError() async {
        var attempts = 0
        let retained = ready("visible", createdAt: date(20))
        let refreshed = ready("refreshed", createdAt: date(20))
        let model = HomeModel(loadWorkouts: {
            attempts += 1
            if attempts == 2 { throw RepositoryError.notFound }
            return attempts == 1 ? [retained] : [refreshed]
        }, now: { self.date(20) }, calendar: calendar)
        await model.load(); XCTAssertEqual(model.workouts, [retained]); XCTAssertNil(model.errorMessage)
        await model.load(); XCTAssertEqual(model.workouts, [retained]); XCTAssertEqual(model.errorMessage, "Home could not be loaded.")
        await model.load(); XCTAssertEqual(model.workouts, [refreshed]); XCTAssertNil(model.errorMessage)
    }

    func testActiveWorkoutCreatedTodayAppears() {
        let workout = ready("today", createdAt: date(20))
        XCTAssertEqual(HomeWorkoutQuery.visibleWorkouts(in: [workout], now: date(20), calendar: calendar).map(\.id), [workout.id])
    }

    func testActiveWorkoutCreatedOnAnEarlierDayStillAppears() {
        let workout = ready("older-ready", createdAt: date(2))
        XCTAssertEqual(HomeWorkoutQuery.visibleWorkouts(in: [workout], now: date(20), calendar: calendar).map(\.id), [workout.id])
    }

    func testInProgressWorkoutCreatedOnAnEarlierDayStillAppears() {
        let workout = inProgress("older-progress", createdAt: date(2))
        XCTAssertEqual(HomeWorkoutQuery.visibleWorkouts(in: [workout], now: date(20), calendar: calendar).map(\.id), [workout.id])
    }

    func testWorkoutCompletedTodayAppears() {
        let workout = completed("completed-today", createdAt: date(2), completedAt: date(20, hour: 8))
        XCTAssertEqual(HomeWorkoutQuery.visibleWorkouts(in: [workout], now: date(20), calendar: calendar).map(\.id), [workout.id])
    }

    func testWorkoutCompletedBeforeTodayDoesNotAppear() {
        let workout = completed("completed-yesterday", createdAt: date(20), completedAt: date(19, hour: 23))
        XCTAssertTrue(HomeWorkoutQuery.visibleWorkouts(in: [workout], now: date(20), calendar: calendar).isEmpty)
    }

    func testYesterdayCompletedWorkoutLeavesHomeAfterRolloverWithoutDeletion() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let completedToday = completed("finished", createdAt: date(2), completedAt: date(20, hour: 18))
        let active = ready("active", createdAt: date(2))
        try await repository.materializeAtomically([completedToday, active])

        let beforeRollover = HomeModel(repository: repository, now: { self.date(20, hour: 22) }, calendar: calendar)
        await beforeRollover.load()
        XCTAssertEqual(beforeRollover.workouts.map(\.id), [active.id, completedToday.id])

        let afterRollover = HomeModel(repository: repository, now: { self.date(21, hour: 1) }, calendar: calendar)
        await afterRollover.load()
        XCTAssertEqual(afterRollover.workouts.map(\.id), [active.id])
        let persisted = try await repository.workout(id: completedToday.id)
        XCTAssertEqual(persisted?.completedAt, completedToday.completedAt)
    }

    func testCreatedAtDoesNotControlHomeMembership() {
        let oldActive = ready("old-active", createdAt: date(2))
        let oldCompletedToday = completed("old-completed-today", createdAt: date(2), completedAt: date(20))
        let newCompletedYesterday = completed("new-completed-yesterday", createdAt: date(20), completedAt: date(19))
        let ids = HomeWorkoutQuery.visibleWorkouts(in: [newCompletedYesterday, oldCompletedToday, oldActive], now: date(20), calendar: calendar).map(\.id)
        XCTAssertEqual(ids, [oldActive.id, oldCompletedToday.id])
    }

    func testHomeOrderingIsStableWhenAWorkoutCompletesToday() async {
        let first = ready("first", createdAt: date(2))
        let second = inProgress("second", createdAt: date(3))
        let third = ready("third", createdAt: date(4))
        let model = HomeModel(loadWorkouts: { [first, second, third] }, now: { self.date(20) }, calendar: calendar)
        await model.load()
        var completedSecond = second
        completedSecond.status = .completed; completedSecond.completedAt = date(20); completedSecond.updatedAt = date(20)
        model.applyPersistedWorkout(completedSecond)
        XCTAssertEqual(model.workouts.map(\.id), [first.id, second.id, third.id])
    }

    func testAddWorkoutPresentationDefersTheSelectedFlowUntilDrawerDismisses() {
        let model = HomeModel(loadWorkouts: { [] }, now: { self.date(20) }, calendar: calendar)
        model.isAddWorkoutDrawerPresented = true
        model.selectCreationRoute(.pasteWorkout)
        XCTAssertFalse(model.isAddWorkoutDrawerPresented); XCTAssertNil(model.creationRoute)
        model.presentPendingCreationRoute()
        XCTAssertEqual(model.creationRoute, .pasteWorkout)
    }

    func testReuseAvailabilityRequiresACompletedCanonicalWorkout() async {
        let noReuse = HomeModel(loadWorkouts: { [self.ready("active", createdAt: self.date(2))] }, now: { self.date(20) }, calendar: calendar)
        await noReuse.load()
        XCTAssertFalse(noReuse.hasReusableWorkouts)

        let reusable = HomeModel(loadWorkouts: { [self.completed("history", createdAt: self.date(2), completedAt: self.date(19))] }, now: { self.date(20) }, calendar: calendar)
        await reusable.load()
        XCTAssertTrue(reusable.hasReusableWorkouts)
    }

    func testPrimarySurfaceIsTransientAndDefaultsToHome() {
        let model = HomeModel(loadWorkouts: { [] }, now: { self.date(20) }, calendar: calendar)
        XCTAssertEqual(model.primarySurface, .home)
        model.primarySurface = .timer
        XCTAssertEqual(model.primarySurface, .timer)
    }

    func testHomeTimerSurfacePullTracksOnlyTheDirectionTowardTheOtherSurface() {
        XCTAssertEqual(
            HomeTimerSurfacePull.progress(from: .home, translation: -200, height: 800),
            0.25,
            accuracy: 0.001
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.progress(from: .home, translation: 200, height: 800),
            0,
            accuracy: 0.001
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.progress(from: .timer, translation: 200, height: 800),
            0.75,
            accuracy: 0.001
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.progress(from: .timer, translation: -200, height: 800),
            1,
            accuracy: 0.001
        )
    }

    func testHomeTimerSurfacePullSettlesUsingDistanceOrProjectedIntent() {
        XCTAssertEqual(
            HomeTimerSurfacePull.destination(
                from: .home,
                translation: -160,
                predictedTranslation: -160,
                height: 800
            ),
            .timer
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.destination(
                from: .home,
                translation: -40,
                predictedTranslation: -40,
                height: 800
            ),
            .home
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.destination(
                from: .home,
                translation: -40,
                predictedTranslation: -120,
                height: 800
            ),
            .timer
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.destination(
                from: .timer,
                translation: 160,
                predictedTranslation: 160,
                height: 800
            ),
            .home
        )
        XCTAssertEqual(
            HomeTimerSurfacePull.destination(
                from: .timer,
                translation: 40,
                predictedTranslation: 40,
                height: 800
            ),
            .timer
        )
    }

    func testAddWorkoutTransitionWaitsForSettledFinalCarouselPosition() {
        XCTAssertFalse(
            HomeAddWorkoutVisibility.showsCarouselDestination(
                isAtAddWorkoutCard: true,
                scrollIsIdle: false
            )
        )
        XCTAssertFalse(
            HomeAddWorkoutVisibility.showsCarouselDestination(
                isAtAddWorkoutCard: false,
                scrollIsIdle: true
            )
        )
        XCTAssertTrue(
            HomeAddWorkoutVisibility.showsCarouselDestination(
                isAtAddWorkoutCard: true,
                scrollIsIdle: true
            )
        )
    }

    func testAddWorkoutDrawerUsesTwoOrThreeActionColumns() {
        XCTAssertEqual(HomeAddWorkoutDrawerLayout.columnCount(hasReusableWorkouts: false), 2)
        XCTAssertEqual(HomeAddWorkoutDrawerLayout.columnCount(hasReusableWorkouts: true), 3)
        XCTAssertEqual(EQLayout.Home.addWorkoutActionIconSize, 20)
        XCTAssertEqual(EQLayout.Home.addWorkoutSheetTopSpacing, 40)
        XCTAssertEqual(EQLayout.Home.addWorkoutTitleToCardsSpacing, 40)
        XCTAssertEqual(EQLayout.Home.addWorkoutSheetBottomSpacing, 40)
    }

    func testSettingsOverlayShrinksHomeWithoutMovingIt() {
        XCTAssertEqual(
            HomeOverlayPresentation.backgroundScale(isPresented: false, reduceMotion: false),
            1
        )
        XCTAssertEqual(
            HomeOverlayPresentation.backgroundScale(isPresented: true, reduceMotion: false),
            EQLayout.Home.overlayBackgroundScale
        )
        XCTAssertEqual(
            HomeOverlayPresentation.backgroundScale(isPresented: true, reduceMotion: true),
            1
        )
    }

    func testCarouselIndexParallaxLagsBehindCardMotion() {
        XCTAssertEqual(
            HomeCarouselIndexParallax.offset(
                cardMidX: 200,
                viewportWidth: 400,
                cardWidth: 320,
                reduceMotion: false
            ),
            0
        )
        XCTAssertGreaterThan(
            HomeCarouselIndexParallax.offset(
                cardMidX: 40,
                viewportWidth: 400,
                cardWidth: 320,
                reduceMotion: false
            ),
            0
        )
        XCTAssertLessThan(
            HomeCarouselIndexParallax.offset(
                cardMidX: 360,
                viewportWidth: 400,
                cardWidth: 320,
                reduceMotion: false
            ),
            0
        )
        XCTAssertEqual(
            HomeCarouselIndexParallax.offset(
                cardMidX: 40,
                viewportWidth: 400,
                cardWidth: 320,
                reduceMotion: true
            ),
            0
        )
    }

    func testExecutionPresentationTracksOnlyTheSelectedWorkoutIDAndClearsOnExit() async {
        let first = ready("first", createdAt: date(2))
        let second = ready("second", createdAt: date(3))
        let model = HomeModel(loadWorkouts: { [first, second] }, now: { self.date(20) }, calendar: calendar)
        await model.load()
        let canonicalHomeProjection = model.workouts

        model.beginExecution(for: first.id)
        XCTAssertEqual(model.expandedWorkoutID, first.id)
        XCTAssertEqual(model.workouts, canonicalHomeProjection)

        model.beginExecution(for: second.id)
        XCTAssertEqual(model.expandedWorkoutID, second.id)
        XCTAssertEqual(model.workouts, canonicalHomeProjection)

        model.endExecution()
        XCTAssertNil(model.expandedWorkoutID)
        XCTAssertEqual(model.workouts, canonicalHomeProjection)
    }

    func testCarouselGeometryKeepsSymmetricGuttersAcrossContainerWidths() {
        for width: CGFloat in [320, 375, 393, 430, 768] {
            let geometry = HomeCarouselGeometry(containerWidth: width, horizontalGutter: 24)

            XCTAssertLessThanOrEqual(geometry.cardWidth, width)
            XCTAssertEqual(geometry.horizontalGutter, 24)
            XCTAssertEqual(geometry.cardWidth + geometry.horizontalGutter * 2, width)
        }
    }

    func testCarouselGeometryRemainsValidForConstrainedContainers() {
        let geometry = HomeCarouselGeometry(containerWidth: 32, horizontalGutter: 24)

        XCTAssertEqual(geometry.horizontalGutter, 16)
        XCTAssertEqual(geometry.cardWidth, 0)
        XCTAssertLessThanOrEqual(geometry.cardWidth, geometry.containerWidth)
    }

    func testCompletionDuringExpandedExecutionRemainsOnHomeTodayAfterExit() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = ready("expanded-completion", createdAt: date(2))
        try await repository.create(fixture)
        let home = HomeModel(repository: repository, now: { self.date(20) }, calendar: calendar)
        await home.load()
        home.beginExecution(for: fixture.id)

        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { self.date(20) }, didPersist: { home.applyPersistedWorkout($0) })
        await execution.activate()
        for prescription in fixture.exercises[0].prescriptions {
            await execution.log(exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
        }
        home.endExecution()

        XCTAssertNil(home.expandedWorkoutID)
        XCTAssertEqual(home.workouts.map(\.id), [fixture.id])
        XCTAssertEqual(home.workouts.first?.status, .completed)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.completedAt, date(20))
    }

    func testReadyWorkoutSurvivesRepositoryRecreationWithoutMutation() async throws {
        let url = TestSupport.temporaryStoreURL(); let original = EquilibriumFixtures.ready(id: "indefinite-ready")
        do { let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url)); try await repository.create(original) }
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let active = try await reopened.activeWorkouts()
        XCTAssertEqual(active, [original])
        let started = try await reopened.startWorkout(id: original.id, at: EquilibriumFixtures.timestamp.addingTimeInterval(9_999_999))
        XCTAssertEqual(started.status, .inProgress)
    }

    func testInProgressWorkoutSurvivesRecreationAndCanResumeAndCompleteMuchLater() async throws {
        let url = TestSupport.temporaryStoreURL()
        let original = EquilibriumFixtures.inProgress(id: "indefinite-progress")
        do {
            let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
            try await repository.create(original)
        }
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let active = try await reopened.activeWorkouts()
        XCTAssertEqual(active, [original])
        let persisted = try await reopened.workout(id: original.id)
        var resumed = try XCTUnwrap(persisted)
        XCTAssertEqual(resumed.exercises[0].loggedSets.first?.repetitions, 8)
        let muchLater = EquilibriumFixtures.timestamp.addingTimeInterval(99_999_999)
        for prescription in resumed.exercises[0].prescriptions where !resumed.exercises[0].loggedSets.contains(where: { $0.prescriptionID == prescription.id }) {
            resumed = try await reopened.logSet(workoutID: resumed.id, exerciseID: resumed.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: .init(pounds: 135), repetitions: 8), completed: true, at: muchLater)
        }
        let completed = try await reopened.completeWorkout(id: resumed.id, at: muchLater.addingTimeInterval(1))
        XCTAssertEqual(completed.status, .completed)
        let remaining = try await reopened.activeWorkouts()
        XCTAssertTrue(remaining.isEmpty)
    }

    func testStableIDTieBreakAndStatusMutationDoNotReorder() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); let instant = Date(timeIntervalSince1970: 10)
        var b = EquilibriumFixtures.ready(id: "b"); b.createdAt = instant
        var a = EquilibriumFixtures.ready(id: "a"); a.createdAt = instant
        try await repository.materializeAtomically([b, a])
        let initialIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(initialIDs, [a.id, b.id])
        _ = try await repository.startWorkout(id: b.id, at: .init(timeIntervalSince1970: 20))
        let updatedIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(updatedIDs, [a.id, b.id])
    }

    func testCardMappingAndStableRouteIdentity() {
        XCTAssertEqual(HomeCardPresentation(status: .ready).action, .start); XCTAssertEqual(HomeCardPresentation(status: .completed).action, .view)
        XCTAssertNotEqual(HomeOverlayDestination.history, HomeOverlayDestination.settings)
    }
}

final class ThemeSystemTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        let suite = "ThemeSystemTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    func testGroveIsTheDefaultLightTheme() {
        let store = EQThemeStore(defaults: makeDefaults())
        XCTAssertEqual(EQTheme.default.id, .grove)
        XCTAssertEqual(store.theme.id, .grove)
        XCTAssertEqual(store.theme.colorScheme, .light)
    }

    func testSelectionPersistsAcrossStores() {
        let defaults = makeDefaults()
        EQThemeStore(defaults: defaults).select(.dusk)
        let reloaded = EQThemeStore(defaults: defaults)
        XCTAssertEqual(reloaded.theme.id, .dusk)
        XCTAssertEqual(reloaded.theme.colorScheme, .dark)
    }

    func testUnknownStoredThemeFallsBackToDefault() {
        let defaults = makeDefaults()
        defaults.set("retired-theme", forKey: EQThemeStore.storageKey)
        XCTAssertEqual(EQThemeStore(defaults: defaults).theme.id, EQTheme.default.id)
    }

    func testEveryThemeIDResolvesToAUniquelyNamedTheme() {
        XCTAssertEqual(Set(EQTheme.all.map(\.id)), Set(EQTheme.ID.allCases))
        XCTAssertEqual(Set(EQTheme.all.map(\.name)).count, EQTheme.all.count)
        for id in EQTheme.ID.allCases { XCTAssertEqual(EQTheme.theme(for: id).id, id) }
    }
}

final class NumberPadTests: XCTestCase {
    func testDecimalKeyOnlyAppearsForDecimalInputs() {
        XCTAssertEqual(EQNumberPadLayout.rows(allowsDecimal: true)[3][0], .decimal)
        XCTAssertNil(EQNumberPadLayout.rows(allowsDecimal: false)[3][0])
        XCTAssertEqual(EQNumberPadLayout.rows(allowsDecimal: false).flatMap { $0 }.compactMap { $0 }.count, 11)
    }

    func testDecimalPointCanOnlyBeTypedOnce() {
        XCTAssertTrue(EQNumberPadEditing.acceptsDecimal(text: "28", replacing: ""))
        XCTAssertFalse(EQNumberPadEditing.acceptsDecimal(text: "28.5", replacing: ""))
        XCTAssertTrue(EQNumberPadEditing.acceptsDecimal(text: "28.5", replacing: "28.5"))
    }
}
