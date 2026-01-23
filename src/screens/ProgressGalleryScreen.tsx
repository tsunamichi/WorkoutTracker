import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import dayjs from 'dayjs';
import { formatWeight } from '../utils/weight';
import { useTranslation } from '../i18n/useTranslation';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProgressGalleryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { progressLogs, settings } = useStore();
  const { t } = useTranslation();

  const sorted = useMemo(
    () => [...progressLogs].sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()),
    [progressLogs]
  );

  const gap = 2;
  const horizontalPadding = SPACING.xxl;
  const tileSize = (SCREEN_WIDTH - horizontalPadding * 2 - gap * 2) / 3;
  const tileHeight = tileSize * (16 / 9);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={1}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('progress')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        columnWrapperStyle={{ gap }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ProgressLogDetail', { progressLogId: item.id })}
            style={[styles.tile, { width: tileSize, height: tileHeight, marginBottom: gap }]}
          >
            <Image source={{ uri: item.photoUri }} style={styles.tileImage} />
            <View style={styles.tileOverlay}>
              <Text style={styles.tileWeight}>
                {formatWeight(item.weightLbs, settings.useKg)} {settings.useKg ? 'kg' : 'lb'}
              </Text>
              <Text style={styles.tileDate}>{item.dateLabel}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('noProgressYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('progressEmptyCtaLocked')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
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
  listContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  tile: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: COLORS.activeCard,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tileWeight: {
    ...TYPOGRAPHY.meta,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tileDate: {
    ...TYPOGRAPHY.meta,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
});

