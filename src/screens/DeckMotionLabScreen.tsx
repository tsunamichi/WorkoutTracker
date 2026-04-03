import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeckMotionLab } from '../components/schedule/DeckMotionLab';

export function DeckMotionLabScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Deck Motion Lab</Text>
        <Text style={styles.subtitle}>A/B/C only - isolated choreography test</Text>
      </View>
      <DeckMotionLab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F5F6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
});
