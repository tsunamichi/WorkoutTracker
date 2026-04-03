import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

type UnderlinedActionButtonProps = {
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

export function UnderlinedActionButton({
  label,
  onPress,
  activeOpacity = 0.85,
  style,
  textStyle,
  color = COLORS.inkCharcoal,
  underlineColor,
  underlineOffset = 2,
  underlineHeight = StyleSheet.hairlineWidth,
}: UnderlinedActionButtonProps) {
  const lineColor = underlineColor ?? color;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity} style={[styles.button, style]}>
      <Text style={[styles.text, { color }, textStyle]}>{label}</Text>
      <View style={[styles.underline, { backgroundColor: lineColor, marginTop: underlineOffset, height: underlineHeight }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...TYPOGRAPHY.legal,
    fontWeight: '400',
  },
  underline: {
    width: '100%',
  },
});
