import React from 'react';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { IconUser } from './icons';
import { COLORS } from '../constants';

interface ProfileAvatarProps {
  onPress: () => void;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  showInitial?: boolean;
}

export function ProfileAvatar({ 
  onPress, 
  size = 32,
  backgroundColor = COLORS.canvas,
  textColor = COLORS.textPrimary,
  showInitial = false,
}: ProfileAvatarProps) {
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
      activeOpacity={0.7}
    >
      {showInitial ? (
        <Text style={[styles.initial, { color: textColor, fontSize: size * 0.5 }]}>U</Text>
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


