import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconAdd } from '../icons';
import { DiagonalLinePattern } from '../common/DiagonalLinePattern';
import type { ProgressPhoto } from '../../types';

interface PhotoCheckInCardProps {
  latestPhoto: ProgressPhoto | null;
  recentPhotos: ProgressPhoto[];
  onAddPhoto: () => void;
  onPhotoPress: (photo: ProgressPhoto) => void;
}

export function PhotoCheckInCard({
  latestPhoto,
  recentPhotos,
  onAddPhoto,
  onPhotoPress,
}: PhotoCheckInCardProps) {
  return (
    <View style={styles.container}>
      {latestPhoto ? (
        <TouchableOpacity
          testID="progress-body-weekly-card-photo"
          style={styles.mainCard}
          onPress={() => onPhotoPress(latestPhoto)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: latestPhoto.imageUri }} style={styles.thumbnail} />
          <View style={styles.cardInfo}>
            <Text style={styles.label}>{latestPhoto.label}</Text>
            <Text style={styles.date}>{latestPhoto.date}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        testID="progress-body-log-checkin-button"
        onPress={onAddPhoto}
        activeOpacity={0.7}
        style={styles.addButton}
      >
        <DiagonalLinePattern width="100%" height={48} borderRadius={BORDER_RADIUS.md} />
        <IconAdd size={18} color={COLORS.text} />
        <Text style={styles.addText}>Add photo</Text>
      </TouchableOpacity>

      {recentPhotos.length > 1 && (
        <FlatList
          testID="progress-body-gallery"
          horizontal
          data={recentPhotos.slice(0, 6)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              testID={`progress-body-gallery-item-${index}`}
              onPress={() => onPhotoPress(item)}
              activeOpacity={0.8}
              style={styles.stripItem}
            >
              <Image source={{ uri: item.imageUri }} style={styles.stripImage} />
              <Text style={styles.stripLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  mainCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderDimmed,
  },
  thumbnail: {
    width: 72,
    height: 72,
  },
  cardInfo: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  date: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  addButton: {
    width: '100%',
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  addText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  photoStrip: {
    marginTop: SPACING.xs,
  },
  stripItem: {
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  stripImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.activeCard,
  },
  stripLabel: {
    ...TYPOGRAPHY.note,
    color: COLORS.textMeta,
    marginTop: 4,
  },
});
