import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import dayjs from 'dayjs';
import { formatWeight } from '../utils/weight';

export function ProgressLogDetailScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { progressLogs, deleteProgressLog, settings } = useStore();
  const { t } = useTranslation();

  const progressLogId: string | undefined = route?.params?.progressLogId;
  const log = useMemo(() => progressLogs.find(l => l.id === progressLogId), [progressLogs, progressLogId]);

  if (!log) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={1}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('progress')}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.missingState}>
          <Text style={styles.missingText}>{t('progressLogNotFound')}</Text>
        </View>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      t('deleteProgressLogTitle'),
      t('deleteProgressLogMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteProgressLog(log.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={1}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('progress')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.content}>
        <Image source={{ uri: log.photoUri }} style={styles.image} />
        <View style={styles.metaCard}>
          <Text style={styles.weightText}>
            {formatWeight(log.weightLbs, settings.useKg)} {settings.useKg ? 'kg' : 'lb'}
          </Text>
          <Text style={styles.dateText}>
            {dayjs(log.createdAt).format('MMMM D, YYYY')}
          </Text>
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.9}>
          <Text style={styles.deleteButtonText}>{t('delete')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    gap: SPACING.lg,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.activeCard,
  },
  metaCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.activeCard,
    padding: SPACING.lg,
    gap: 6,
  },
  weightText: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  dateText: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  deleteButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.signalNegative,
    fontWeight: '700',
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  missingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
});

