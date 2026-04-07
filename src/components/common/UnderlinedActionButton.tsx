import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

export type TertiaryButtonProps = {
  label: string;
  onPress: () => void;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
  underlineColor?: string;
  underlineOffset?: number;
  underlineHeight?: number;
};

export function TertiaryButton({
  label,
  onPress,
  activeOpacity = 0.85,
  style,
  textStyle,
  color = COLORS.inkCharcoal,
  underlineColor,
  underlineOffset = 2,
  underlineHeight = StyleSheet.hairlineWidth,
}: TertiaryButtonProps) {
  const lineColor = underlineColor ?? color;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity} style={[styles.button, style]}>
      <View
        style={[
          styles.labelWrap,
          { paddingBottom: underlineOffset, borderBottomColor: lineColor, borderBottomWidth: underlineHeight },
        ]}
      >
        <Text style={[styles.text, { color }, textStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Backward compatibility for existing imports while we migrate usage.
export const UnderlinedActionButton = TertiaryButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    alignItems: 'center',
  },
  text: {
    ...TYPOGRAPHY.legal,
    fontWeight: '400',
  },
});
