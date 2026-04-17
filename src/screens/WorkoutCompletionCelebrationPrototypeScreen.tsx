/**
 * Dev / design preview for `WorkoutCompletionCelebrationScreen`.
 * Navigate here to iterate on motion and layout (not wired to completion flow yet).
 */
import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WorkoutCompletionCelebrationScreen } from '../components/celebration/WorkoutCompletionCelebrationScreen';

export function WorkoutCompletionCelebrationPrototypeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrap}>
      <WorkoutCompletionCelebrationScreen
        autoPlay
        onRequestClose={() => navigation.goBack()}
      />
      <Pressable
        style={[styles.floatingClose, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close prototype"
      >
        <Text style={styles.floatingCloseText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  floatingClose: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  floatingCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
