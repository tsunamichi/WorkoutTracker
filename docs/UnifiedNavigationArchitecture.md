# Unified Home–Execution Navigation

`HomeView` owns the Home ↔ execution lifecycle. It drives `homeExecutionProgress`, supplies the source and destination wallet frames, and only tears down execution after the return transition’s logical completion.

`UnifiedHomeExecutionRenderer` is the single geometry animation authority for the production Home ↔ execution transition. Given that one progress value, it resolves the wallet viewport, composes a stable wallet-local list canvas, translates only the foreground region, then applies the rounded wallet clip. New Home/execution visuals should be added to that renderer’s surface or foreground closures; do not add another progress value, geometry reader, or stateful execution subtree for the same transition.

Settings is intentionally outside that clip. While Settings is presented, the existing external focused host owns the approved Settings expansion/collapse using `settingsTransitionProgress`; its `ExecutionForegroundExitTranslationModifier` is specific to that presentation and must not become a second Home/execution timeline.

`ExecutionPrimaryActionFooter` remains the sole execution footer. In the unified foreground it is above the focused card and values layers with `zIndex(3)`, so the Log set action stays visible after Settings returns to execution.

When extending this area, keep transition completion responsible for model teardown, retain the single stateful execution tree, and route new Home/execution geometry through `HomeExecutionPresentationGeometry`. Settings-specific presentation changes should remain external and unclipped rather than competing with the unified renderer.
