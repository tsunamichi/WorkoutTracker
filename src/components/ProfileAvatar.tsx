import React from 'react';
import { TouchableOpacity, StyleSheet, Text, Image } from 'react-native';
import { IconUser } from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { useAppTheme } from '../theme/useAppTheme';

interface ProfileAvatarProps {
  onPress: () => void;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  showInitial?: boolean;
  imageUri?: string | null;
}

export function ProfileAvatar({
  onPress,
  size = 32,
  backgroundColor: bgProp,
  textColor: textColorProp,
  showInitial = false,
  imageUri = null,
}: ProfileAvatarProps) {
  const { colors: themeColors } = useAppTheme();
  const backgroundColor = bgProp ?? themeColors.canvas;
  const textColor = textColorProp ?? themeColors.textPrimary;
  const { t } = useTranslation();
  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size,
          backgroundColor,
        }
      ]} 
      onPress={onPress}
      activeOpacity={1}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: 999 }} />
      ) : showInitial ? (
        <Text style={[styles.initial, { color: textColor, fontSize: size * 0.5 }]}>
          {t('userInitial')}
        </Text>
      ) : (
        <IconUser size={size * 0.6} color={textColor} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '600',
  },
});

