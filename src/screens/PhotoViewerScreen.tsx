import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconTrash } from '../components/icons';
import type { ProgressPhoto } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.55;

export function PhotoViewerScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { photoId } = route.params;
  const { progressPhotos, deleteProgressPhoto } = useStore();
  const listRef = useRef<FlatList>(null);

  const sorted = useMemo(
    () => [...progressPhotos].sort((a, b) => b.date.localeCompare(a.date)),
    [progressPhotos],
  );

  const initialIndex = useMemo(
    () => Math.max(0, sorted.findIndex((p) => p.id === photoId)),
    [sorted, photoId],
  );

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activePhoto: ProgressPhoto | undefined = sorted[activeIndex];

  const handleDelete = () => {
    if (!activePhoto) return;
    Alert.alert('Delete Photo', 'This photo will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProgressPhoto(activePhoto.id);
          if (sorted.length <= 1) {
            navigation.goBack();
          }
        },
      },
    ]);
  };

  return (
    <View testID="photo-viewer-screen" style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={1}
        >
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {activePhoto && (
            <>
              <Text style={styles.headerLabel}>{activePhoto.label}</Text>
              <Text style={styles.headerDate}>
                {dayjs(activePhoto.date).format('MMM D, YYYY')}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity
          testID="photo-viewer-delete"
          onPress={handleDelete}
          style={styles.deleteButton}
          activeOpacity={0.7}
        >
          <IconTrash size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Main image carousel */}
      <FlatList
        ref={listRef}
        testID="photo-viewer-carousel"
        data={sorted}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}
      />

      {/* Page dots */}
      {sorted.length > 1 && (
        <View style={styles.dots}>
          {sorted.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Info */}
      {activePhoto?.notes ? (
        <View style={[styles.notes, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Text style={styles.notesText}>{activePhoto.notes}</Text>
        </View>
      ) : (
        <View style={{ height: insets.bottom + SPACING.md }} />
      )}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  headerDate: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginTop: 2,
  },
  deleteButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH - SPACING.xxl * 2,
    height: IMAGE_HEIGHT,
    borderRadius: BORDER_RADIUS.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.text,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notes: {
    paddingHorizontal: SPACING.xxl,
  },
  notesText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
});
