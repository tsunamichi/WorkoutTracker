import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, GRADIENTS, BUTTONS } from '../constants';
import { 
  IconAdd, IconCheck, IconPlay, IconPause, IconEdit, IconTrash, 
  IconCalendar, IconWorkouts, IconUser, IconArrowLeft 
} from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';

interface DesignSystemScreenProps {
  navigation: any;
}

const LIGHT_COLORS = {
  backgroundCanvas: COLORS.backgroundCanvas,
  backgroundContainer: COLORS.backgroundContainer,
  secondary: '#1B1B1B',
  textSecondary: '#3C3C43',
  textMeta: COLORS.textMeta,
  border: COLORS.border,
  accentPrimary: COLORS.accentPrimary,
  accentPrimaryLight: COLORS.accentPrimaryLight,
  accentPrimaryDark: COLORS.accentPrimaryDark,
  signalPositive: COLORS.signalPositive,
  overlay: COLORS.overlay,
};

export function DesignSystemScreen({ navigation }: DesignSystemScreenProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18L9 12L15 6"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('designSystemTitle')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} bounces={false}>
          {/* Colors Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('colorsTitle')}</Text>
            <View style={styles.colorList}>
              {Object.entries(LIGHT_COLORS).map(([name, value]) => (
                <View key={name} style={styles.colorRow}>
                  <View style={styles.colorInfo}>
                    <Text style={styles.colorName}>{name}</Text>
                    <Text style={styles.colorValue}>{value}</Text>
                  </View>
                  {name === 'accentPrimary' ? (
                    <View style={styles.colorSwatchWrapper}>
                      <LinearGradient
                        colors={GRADIENTS.accentPrimary.colors}
                        start={GRADIENTS.accentPrimary.start}
                        end={GRADIENTS.accentPrimary.end}
                        style={styles.colorSwatchGradient}
                      />
                    </View>
                  ) : name === 'accentPrimaryLight' || name === 'accentPrimaryDark' ? (
                    <View style={styles.colorSwatchWrapper}>
                      <View style={[styles.colorSwatchGradient, { backgroundColor: value }]} />
                    </View>
                  ) : (
                    <View style={[styles.colorSwatch, { backgroundColor: value }]} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Spacing Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('spacingTitle')}</Text>
            {Object.entries(SPACING).map(([name, value], index) => (
              <View key={name}>
                <View style={styles.spacingRow}>
                  <View style={styles.spacingInfo}>
                    <Text style={styles.spacingName}>{name}</Text>
                    <Text style={styles.spacingValue}>{value}px</Text>
                  </View>
                  <View style={[styles.spacingBar, { width: value }]} />
                </View>
                {index < Object.entries(SPACING).length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {/* Typography Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('typographyTitle')}</Text>
            <View style={styles.typographyRow}>
              <Text style={[styles.typographyLabel, TYPOGRAPHY.h1]}>H1 {t('typographyTitle')}</Text>
              <Text style={styles.typographyMeta}>
                {TYPOGRAPHY.h1.fontSize}px / {TYPOGRAPHY.h1.fontWeight}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.typographyRow}>
              <Text style={[styles.typographyLabel, TYPOGRAPHY.h2]}>H2 {t('typographyTitle')}</Text>
              <Text style={styles.typographyMeta}>
                {TYPOGRAPHY.h2.fontSize}px / {TYPOGRAPHY.h2.fontWeight}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.typographyRow}>
              <Text style={[styles.typographyLabel, TYPOGRAPHY.h3]}>H3 {t('typographyTitle')}</Text>
              <Text style={styles.typographyMeta}>
                {TYPOGRAPHY.h3.fontSize}px / {TYPOGRAPHY.h3.fontWeight}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.typographyRow}>
              <Text style={[styles.typographyLabel, TYPOGRAPHY.body]}>Body {t('typographyTitle')}</Text>
              <Text style={styles.typographyMeta}>
                {TYPOGRAPHY.body.fontSize}px / {TYPOGRAPHY.body.fontWeight}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.typographyRow}>
              <Text style={[styles.typographyLabel, TYPOGRAPHY.meta]}>Meta {t('typographyTitle')}</Text>
              <Text style={styles.typographyMeta}>
                {TYPOGRAPHY.meta.fontSize}px / {TYPOGRAPHY.meta.fontWeight}
              </Text>
            </View>
          </View>

          {/* Border Radius Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('borderRadiusTitle')}</Text>
            <View style={styles.radiusList}>
              {Object.entries(BORDER_RADIUS).map(([name, value]) => (
                <View key={name} style={styles.radiusItem}>
                  <View style={[styles.radiusBoxWrapper, { borderRadius: value }]}>
                    <LinearGradient
                      colors={GRADIENTS.accentPrimary.colors}
                      start={GRADIENTS.accentPrimary.start}
                      end={GRADIENTS.accentPrimary.end}
                      style={[styles.radiusBox, { borderRadius: value }]}
                    />
                  </View>
                  <Text style={styles.radiusName}>{name}</Text>
                  <Text style={styles.radiusValue}>{value}px</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Components Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('componentsTitle')}</Text>
            
            {/* Buttons */}
            <View style={styles.componentGroup}>
              <Text style={styles.componentGroupTitle}>{t('buttonsTitle')}</Text>
              
              {/* Primary Button - No Icon */}
              <TouchableOpacity style={styles.buttonPrimaryWrapper} activeOpacity={1}>
                <LinearGradient
                  colors={GRADIENTS.accentPrimary.colors}
                  start={GRADIENTS.accentPrimary.start}
                  end={GRADIENTS.accentPrimary.end}
                  style={styles.buttonPrimary}
                >
                  <Text style={styles.buttonPrimaryText}>{t('primaryButton')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Primary Button - Icon Left */}
              <TouchableOpacity style={styles.buttonPrimaryWrapper} activeOpacity={1}>
                <LinearGradient
                  colors={GRADIENTS.accentPrimary.colors}
                  start={GRADIENTS.accentPrimary.start}
                  end={GRADIENTS.accentPrimary.end}
                  style={styles.buttonPrimary}
                >
                  <IconPlay size={16} color="#FFFFFF" />
                  <Text style={styles.buttonPrimaryText}>{t('withIconLeft')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Primary Button - Icon Right */}
              <TouchableOpacity style={styles.buttonPrimaryWrapper} activeOpacity={1}>
                <LinearGradient
                  colors={GRADIENTS.accentPrimary.colors}
                  start={GRADIENTS.accentPrimary.start}
                  end={GRADIENTS.accentPrimary.end}
                  style={styles.buttonPrimary}
                >
                  <Text style={styles.buttonPrimaryText}>{t('withIconRight')}</Text>
                  <View style={styles.triangleIcon}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path d="M8 5L16 12L8 19V5Z" fill="#000000" />
                    </Svg>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Primary Button No Label */}
              <View style={styles.buttonRowWithLabel}>
                <TouchableOpacity style={BUTTONS.primaryButtonNoLabel} activeOpacity={1}>
                  <IconPlay size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.buttonInfo}>
                  <Text style={styles.buttonInfoLabel}>{t('primaryButtonNoLabel')}</Text>
                  <Text style={styles.buttonInfoMeta}>
                    {BUTTONS.primaryButtonNoLabel.width}×{BUTTONS.primaryButtonNoLabel.height}px / {BUTTONS.primaryButtonNoLabel.borderRadius}px radius
                  </Text>
                </View>
              </View>
              
              {/* Secondary Button - No Icon */}
              <TouchableOpacity style={styles.buttonSecondary} activeOpacity={1}>
                <Text style={styles.buttonSecondaryText}>{t('secondaryButton')}</Text>
              </TouchableOpacity>
              
              {/* Secondary Button - Icon Left */}
              <TouchableOpacity style={styles.buttonSecondary} activeOpacity={1}>
                <IconEdit size={16} color={LIGHT_COLORS.secondary} />
                <Text style={styles.buttonSecondaryText}>{t('withIconLeft')}</Text>
              </TouchableOpacity>
              
              {/* Secondary Button - Icon Right */}
              <TouchableOpacity style={styles.buttonSecondary} activeOpacity={1}>
                <Text style={styles.buttonSecondaryText}>{t('withIconRight')}</Text>
                <IconArrowLeft size={16} color={LIGHT_COLORS.secondary} />
              </TouchableOpacity>
              
              {/* Text Button - No Icon */}
              <TouchableOpacity style={styles.buttonText} activeOpacity={1}>
                <Text style={styles.buttonTextLabel}>{t('textButton')}</Text>
              </TouchableOpacity>
              
              {/* Text Button - Icon Left */}
              <TouchableOpacity style={styles.buttonText} activeOpacity={1}>
                <IconAdd size={16} color={LIGHT_COLORS.textMeta} />
                <Text style={styles.buttonTextLabel}>{t('withIconLeft')}</Text>
              </TouchableOpacity>
              
              {/* Text Button - Icon Right */}
              <TouchableOpacity style={styles.buttonText} activeOpacity={1}>
                <Text style={styles.buttonTextLabel}>{t('withIconRight')}</Text>
                <IconCheck size={16} color={LIGHT_COLORS.textMeta} />
              </TouchableOpacity>
            </View>
            
            {/* Icons */}
            <View style={styles.componentGroup}>
              <Text style={styles.componentGroupTitle}>{t('iconsTitle')}</Text>
              <View style={styles.iconGrid}>
                <View style={styles.iconItem}>
                  <IconAdd size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconAdd')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconCheck size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconCheck')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconPlay size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconPlay')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconPause size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconPause')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconEdit size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconEdit')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconTrash size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconTrash')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconCalendar size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconCalendar')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconWorkouts size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconWorkouts')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconUser size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconUser')}</Text>
                </View>
                <View style={styles.iconItem}>
                  <IconArrowLeft size={24} color={LIGHT_COLORS.secondary} />
                  <Text style={styles.iconLabel}>{t('iconArrow')}</Text>
                </View>
              </View>
            </View>
            
            {/* Cards */}
            <View style={styles.componentGroup}>
              <Text style={styles.componentGroupTitle}>{t('cardsTitle')}</Text>
              
              {/* Basic Card */}
              <View style={styles.cardExample}>
                <Text style={styles.cardTitle}>{t('basicCard')}</Text>
                <Text style={styles.cardDescription}>
                  A simple card with white background and border radius
                </Text>
              </View>
              
              {/* Card with Shadow */}
              <View style={styles.cardShadowBlack}>
                <View style={styles.cardShadowWhite}>
                  <View style={styles.cardWithShadow}>
                    <View style={styles.cardWithShadowInner}>
                      <Text style={styles.cardTitle}>{t('cardWithDualShadows')}</Text>
                      <Text style={styles.cardDescription}>
                        Black (-1,-1, 8%) and white (1,1, 100%) shadows with border token and inner borders for depth
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  
  // Colors
  colorList: {
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  colorInfo: {
    flex: 1,
  },
  colorSwatchWrapper: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  colorSwatchGradient: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  colorName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
  },
  colorValue: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },

  // Spacing
  spacingRow: {
    paddingVertical: SPACING.md,
  },
  spacingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  spacingName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  spacingValue: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },
  spacingBar: {
    height: 8,
    backgroundColor: LIGHT_COLORS.accentPrimary,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },

  // Typography
  typographyRow: {
    paddingVertical: SPACING.md,
  },
  typographyLabel: {
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  typographyMeta: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },

  // Border Radius
  radiusList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  radiusItem: {
    width: '30%',
    alignItems: 'center',
  },
  radiusBoxWrapper: {
    width: 60,
    height: 60,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  radiusBox: {
    width: 60,
    height: 60,
  },
  radiusName: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    marginBottom: 2,
  },
  radiusValue: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },

  // Components
  componentGroup: {
    marginBottom: SPACING.xxl,
  },
  componentGroupTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.md,
  },

  // Buttons
  buttonPrimaryWrapper: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
    overflow: 'hidden',
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonPrimaryText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonRowWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  buttonInfo: {
    flex: 1,
  },
  buttonInfoLabel: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  buttonInfoMeta: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.activeCard,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    marginBottom: SPACING.md,
  },
  buttonSecondaryText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  triangleIcon: {
    width: 12,
    height: 12,
  },
  buttonText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  buttonTextLabel: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.textMeta,
  },

  // Icons
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  iconItem: {
    width: 60,
    alignItems: 'center',
  },
  iconLabel: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
    marginTop: SPACING.xs,
  },

  // Cards
  cardExample: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  cardShadowBlack: {
  },
  cardShadowWhite: {
  },
  cardWithShadow: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardWithShadowInner: {
    backgroundColor: COLORS.activeCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
  },
  cardTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  cardDescription: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.textMeta,
  },
});

