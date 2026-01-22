import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeight } from '../utils/weight';

interface BodyWeightHistoryScreenProps {
  navigation: any;
}

export function BodyWeightHistoryScreen({ navigation }: BodyWeightHistoryScreenProps) {
  const insets = useSafeAreaInsets();
  const { bodyWeightEntries, settings } = useStore();
  const { t } = useTranslation();

  const entries = React.useMemo(
    () => [...bodyWeightEntries].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()),
    [bodyWeightEntries]
  );
  const weightDeltas = React.useMemo(() => {
    const deltas = new Map<string, number | null>();
    entries.forEach((entry, index) => {
      const previous = entries[index + 1];
      deltas.set(entry.id, previous ? entry.weight - previous.weight : null);
    });
    return deltas;
  }, [entries]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('bodyWeight')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {entries.map(entry => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryRow}>
              <Text style={styles.entryDate}>{dayjs(entry.date).format('MMM D, YYYY')}</Text>
              <View style={styles.entryValueRow}>
                {(() => {
                  const delta = weightDeltas.get(entry.id);
                  if (delta == null || delta === 0) {
                    return (
                      <Text style={[styles.entryDelta, styles.entryDeltaNeutral]}>
                        —
                      </Text>
                    );
                  }
                  const direction = delta > 0 ? 'up' : 'down';
                  const arrow = delta > 0 ? '↑' : '↓';
                  const deltaValue = formatWeight(Math.abs(delta), settings.useKg);
                  return (
                    <Text
                      style={[
                        styles.entryDelta,
                        direction === 'up' ? styles.entryDeltaUp : styles.entryDeltaDown,
                      ]}
                    >
                      {arrow} {deltaValue}
                    </Text>
                  );
                })()}
                <Text style={styles.entryValue}>
                  {formatWeight(entry.weight, settings.useKg)}
                </Text>
                <Text style={styles.entryUnit}>{settings.useKg ? 'kg' : 'lb'}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  entryCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: SPACING.lg,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  entryValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  entryDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  entryUnit: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
  },
  entryDelta: {
    ...TYPOGRAPHY.meta,
  },
  entryDeltaUp: {
    color: COLORS.signalNegative,
  },
  entryDeltaDown: {
    color: COLORS.signalPositive,
  },
  entryDeltaNeutral: {
    color: COLORS.textMeta,
  },
});
