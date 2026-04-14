import React from 'react';
import { TouchableOpacity, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { executionCtaLabelStyle, executionCtaTouchableFixed } from './executionCtaTokens';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeOpacity?: number;
  testID?: string;
};

/**
 * Text-only execution / timer CTA: 56pt tall, 24px horizontal padding, body + regular label.
 * Pass `style` / `textStyle` for colors; do not remove base sizing from overrides.
 */
export function ExecutionControlButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
  activeOpacity = 0.8,
  testID,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[executionCtaTouchableFixed, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
    >
      <Text style={[executionCtaLabelStyle, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}
