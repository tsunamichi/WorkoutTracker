import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutAnimation,
  PanResponder,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import type { AppColorThemeId } from '../types';
import { useAppTheme } from '../theme/useAppTheme';
import { SPACING, TYPOGRAPHY } from '../constants';
import { IconTriangle } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import { signInWithApple, getCurrentUser, signOut, isAppleSignInAvailable, AuthUser } from '../services/authService';
import { uploadBackup, downloadBackup, getCloudBackupInfo } from '../services/cloudSync';
import { isSupabaseConfigured } from '../services/supabase';
import { hexToRgba } from '../constants';
import { BackTextButton } from '../components/common/BackTextButton';
import * as Haptics from 'expo-haptics';
import { buildAppTheme } from '../theme/appTheme';

interface ProfileScreenProps {
  navigation: any;
}

const REST_TIME_MIN = 15;
const REST_TIME_MAX = 300;
const REST_TIME_STEP = 5;
const REST_SLIDER_HEIGHT = 32;
const REST_SLIDER_THUMB_WIDTH = 3;
const REST_SLIDER_THUMB_HEIGHT = 16;
const REST_SLIDER_RADIUS = 10;
const REST_SLIDER_THUMB_INSET = 12;

function RestTimeSlider({
  value,
  min,
  max,
  step,
  onChange,
  onChangeEnd,
  onInteractingChange,
  backgroundColor,
  fillColor,
  thumbColor,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  onChangeEnd?: (next: number) => void;
  onInteractingChange?: (isInteracting: boolean) => void;
  backgroundColor: string;
  fillColor: string;
  thumbColor: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const updateFromPosition = useCallback((positionX: number) => {
    if (trackWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(trackWidth, positionX));
    const ratio = clampedX / trackWidth;
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    const next = Math.max(min, Math.min(max, stepped));
    latestValueRef.current = next;
    onChange(next);
    return next;
  }, [max, min, onChange, step, trackWidth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: evt => {
          onInteractingChange?.(true);
          updateFromPosition(evt.nativeEvent.locationX);
        },
        onPanResponderMove: evt => {
          updateFromPosition(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          onInteractingChange?.(false);
          onChangeEnd?.(latestValueRef.current);
        },
        onPanResponderTerminate: () => {
          onInteractingChange?.(false);
          onChangeEnd?.(latestValueRef.current);
        },
      }),
    [onChangeEnd, onInteractingChange, updateFromPosition],
  );

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillWidth = trackWidth > 0 ? ratio * trackWidth : 0;
  const thumbLeft =
    trackWidth > 0
      ? Math.max(
          0,
          Math.min(
            trackWidth - REST_SLIDER_THUMB_WIDTH,
            fillWidth - REST_SLIDER_THUMB_WIDTH - REST_SLIDER_THUMB_INSET,
          ),
        )
      : 0;

  return (
    <View
      style={[styles.restSliderTrack, { backgroundColor }]}
      onLayout={event => {
        setTrackWidth(event.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.restSliderFill, { width: fillWidth, backgroundColor: fillColor }]} />
      <View style={[styles.restSliderThumb, { left: thumbLeft, backgroundColor: thumbColor }]} />
    </View>
  );
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, initialize } = useStore();
  const { colors: themeColors } = useAppTheme();
  const [restTimeExpanded, setRestTimeExpanded] = useState(false);
  const [isRestSliderInteracting, setIsRestSliderInteracting] = useState(false);
  const [restTimeDraftSeconds, setRestTimeDraftSeconds] = useState(settings.restTimerDefaultSeconds);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [cloudSyncInfo, setCloudSyncInfo] = useState<{ exists: boolean; syncedAt?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { t, language } = useTranslation();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  useEffect(() => {
    // Check Apple Sign-In availability and current auth state
    (async () => {
      await isAppleSignInAvailable();
      if (isSupabaseConfigured()) {
        const user = await getCurrentUser();
        setAuthUser(user);
        if (user) {
          const syncInfo = await getCloudBackupInfo();
          setCloudSyncInfo(syncInfo);
        }
      }
    })();
  }, []);

  const handleToggleUnit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ useKg: !settings.useKg });
  };

  const handleToggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLanguage = language === 'en' ? 'es' : 'en';
    updateSettings({ language: newLanguage });
  };

  const formatRestTime = useCallback(
    (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`,
    [],
  );
  const restTimeDisplaySeconds = restTimeExpanded ? restTimeDraftSeconds : settings.restTimerDefaultSeconds;
  const restTimeFormatted = formatRestTime(restTimeDisplaySeconds);
  const unitLabel = settings.useKg ? 'kg' : 'lb';
  const activeColorTheme: AppColorThemeId = settings.colorTheme ?? 'v1';
  const themeSwatchOptions = [
    {
      id: 'v1' as const,
      bg: buildAppTheme('v1').colors.containerSecondary,
      corner: buildAppTheme('v1').colors.containerPrimary,
    },
    {
      id: 'v2' as const,
      bg: buildAppTheme('v2').colors.containerSecondary,
      corner: buildAppTheme('v2').colors.containerPrimary,
    },
  ];

  const handleColorTheme = (id: AppColorThemeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void updateSettings({ colorTheme: id });
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.canvasLight }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BackTextButton label="Home" onPress={handleBack} />
        
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>{t('settings')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        scrollEnabled={!isRestSliderInteracting}
        showsVerticalScrollIndicator={false}
      >
        {/* Top section: Language/Unit, Theme, Rest Time */}
        <View style={styles.sectionGroupTop}>
          <View style={styles.twoColumnRow}>
            <View style={[styles.splitModule, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
              {/* Language */}
              <TouchableOpacity
                style={styles.flatColumn}
                onPress={handleToggleLanguage}
                activeOpacity={0.7}
              >
                <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>Language</Text>
                <Text style={[styles.flatValue, { color: themeColors.textPrimary }]}>{language.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.splitModule, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
              {/* Unit */}
              <TouchableOpacity
                style={styles.flatColumn}
                onPress={handleToggleUnit}
                activeOpacity={0.7}
              >
                <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>{t('unit')}</Text>
                <Text style={[styles.flatValue, styles.unitValue, { color: themeColors.textPrimary }]}>{unitLabel}s</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Theme */}
          <View style={[styles.sectionBlock, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
            <View style={styles.settingRow}>
              <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>{t('theme')}</Text>
              <View style={styles.themeSwatches}>
                {themeSwatchOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.themeSwatchButton,
                      { borderColor: activeColorTheme === opt.id ? themeColors.containerPrimary : 'transparent' },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleColorTheme(opt.id)}
                  >
                    <View style={[styles.themeSwatchFill, { backgroundColor: opt.bg }]}>
                      <View style={[styles.themeSwatchCorner, { backgroundColor: opt.corner }]} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Rest time */}
          <View style={[styles.sectionBlock, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                if (!restTimeExpanded) {
                  setRestTimeDraftSeconds(settings.restTimerDefaultSeconds);
                }
                setRestTimeExpanded(prev => !prev);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>{t('restTime')}</Text>
              <Text style={[styles.flatValue, { color: themeColors.textPrimary }]}>{restTimeFormatted}</Text>
            </TouchableOpacity>
            {restTimeExpanded ? (
              <View style={styles.restSliderWrap}>
                <RestTimeSlider
                  value={restTimeDraftSeconds}
                  min={REST_TIME_MIN}
                  max={REST_TIME_MAX}
                  step={REST_TIME_STEP}
                  onChange={next => {
                    setRestTimeDraftSeconds(next);
                  }}
                  onChangeEnd={next => updateSettings({ restTimerDefaultSeconds: next })}
                  onInteractingChange={setIsRestSliderInteracting}
                  backgroundColor={themeColors.containerSecondary}
                  fillColor={themeColors.containerPrimary}
                  thumbColor={themeColors.containerSecondary}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Middle section: Auto-progression */}
        <View style={styles.sectionGroupMiddle}>
          <View style={[styles.sectionBlock, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
            <TouchableOpacity 
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Progression');
              }}
            >
              <View style={styles.settingInfo}>
                <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>Auto-progression</Text>
              </View>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <IconTriangle size={12} color={themeColors.text} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom section: Apple cloud */}
        {isSupabaseConfigured() && (
          <View style={[styles.sectionGroupBottom, styles.sectionBlock, { borderTopColor: hexToRgba(themeColors.containerPrimary, 0.35) }]}>
            {authUser ? (
              <>
                {/* Signed in state */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>Apple Account</Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>
                      Signed
                      {authUser.email ? `\n${authUser.email}` : ''}
                      {cloudSyncInfo?.syncedAt
                        ? `\nLast sync: ${new Date(cloudSyncInfo.syncedAt).toLocaleString()}`
                        : ''}
                    </Text>
                  </View>
                </View>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Sync Now */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={async () => {
                    if (isSyncing) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsSyncing(true);
                    const result = await uploadBackup();
                    setIsSyncing(false);
                    if (result.success) {
                      const info = await getCloudBackupInfo();
                      setCloudSyncInfo(info);
                      Alert.alert('Sync Complete', 'Your data has been backed up to the cloud.', [{ text: 'OK' }]);
                    } else {
                      Alert.alert('Sync Failed', result.error || 'Unknown error.', [{ text: 'OK' }]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>
                      {isSyncing ? '⏳ Syncing...' : '☁️ Sync Now'}
                    </Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>Upload your data to the cloud</Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Restore from Cloud */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Restore from Cloud',
                      'This will download your cloud backup and replace current local data. Use this after reinstalling the app.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Restore',
                          style: 'destructive',
                          onPress: async () => {
                            setIsSyncing(true);
                            const result = await downloadBackup();
                            if (result.success) {
                              await initialize();
                              setIsSyncing(false);
                              Alert.alert(
                                'Restore Complete',
                                `Restored ${result.restoredKeys} data entries from the cloud!`,
                                [{ text: 'OK' }]
                              );
                            } else {
                              setIsSyncing(false);
                              Alert.alert('Restore Failed', result.error || 'Unknown error.', [{ text: 'OK' }]);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>📥 Restore from Cloud</Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textPrimary }]}>Download backup after reinstall</Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: themeColors.borderDimmed }]} />

                {/* Sign Out */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Sign Out',
                      'Your local data will remain. You can sign back in anytime to sync again.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Sign Out',
                          style: 'destructive',
                          onPress: async () => {
                            await signOut();
                            setAuthUser(null);
                            setCloudSyncInfo(null);
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>Sign Out</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Not signed in — show Sign In button */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    try {
                      const user = await signInWithApple();
                      setAuthUser(user);
                      // After sign-in, check if there's an existing cloud backup
                      const info = await getCloudBackupInfo();
                      setCloudSyncInfo(info);
                      if (info.exists) {
                        Alert.alert(
                          'Cloud Backup Found',
                          `A backup from ${new Date(info.syncedAt!).toLocaleDateString()} was found.\n\nWould you like to restore it or upload your current data instead?`,
                          [
                            {
                              text: 'Restore Backup',
                              onPress: async () => {
                                const result = await downloadBackup();
                                if (result.success) {
                                  await initialize();
                                  Alert.alert('Restored!', `${result.restoredKeys} data entries restored.`, [{ text: 'OK' }]);
                                }
                              },
                            },
                            {
                              text: 'Upload Current',
                              onPress: async () => {
                                await uploadBackup();
                                const newInfo = await getCloudBackupInfo();
                                setCloudSyncInfo(newInfo);
                              },
                            },
                            { text: 'Later', style: 'cancel' },
                          ]
                        );
                      } else {
                        // No backup exists — auto-upload current data
                        await uploadBackup();
                        const newInfo = await getCloudBackupInfo();
                        setCloudSyncInfo(newInfo);
                        Alert.alert(
                          'Signed In!',
                          'Your workout data has been backed up to the cloud. It will survive app reinstalls.',
                          [{ text: 'OK' }]
                        );
                      }
                    } catch (e: any) {
                      // User cancelled Apple Sign-In — don't show an error
                      if (e?.code === 'ERR_REQUEST_CANCELED') return;
                      Alert.alert('Sign-In Failed', e?.message || 'Unknown error', [{ text: 'OK' }]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.flatLabel, { color: themeColors.containerPrimary }]}>Apple Account</Text>
                  </View>
                  <IconTriangle size={16} color={themeColors.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 0,
    marginBottom: SPACING.xxxl + SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.displayLarge,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  sectionBlock: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
  },
  sectionGroupTop: {
    gap: 32,
  },
  sectionGroupMiddle: {
    marginTop: 64,
  },
  sectionGroupBottom: {
    marginTop: 64,
  },
  sectionTitle: {
    ...TYPOGRAPHY.legal,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: SPACING.xxl,
  },
  splitModule: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderTopWidth: 1,
    paddingTop: SPACING.md,
  },
  flatColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  flatValue: {
    ...TYPOGRAPHY.h1,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  unitValue: {
    textTransform: 'lowercase',
  },
  flatLabel: {
    ...TYPOGRAPHY.legal,
    textTransform: 'uppercase',
    paddingTop: 2,
  },
  themeSwatches: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  themeSwatchButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    padding: 2,
  },
  themeSwatchFill: {
    flex: 1,
  },
  themeSwatchCorner: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '55%',
    height: '55%',
  },
  settingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  restSliderWrap: {
    marginTop: SPACING.lg,
  },
  restSliderTrack: {
    height: REST_SLIDER_HEIGHT,
    borderRadius: REST_SLIDER_RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  restSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: REST_SLIDER_RADIUS,
  },
  restSliderThumb: {
    position: 'absolute',
    width: REST_SLIDER_THUMB_WIDTH,
    height: REST_SLIDER_THUMB_HEIGHT,
    borderRadius: 2,
    top: (REST_SLIDER_HEIGHT - REST_SLIDER_THUMB_HEIGHT) / 2,
  },
  settingDivider: {
    height: 1,
    marginVertical: SPACING.lg,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
  },
  themeHint: {
    marginBottom: SPACING.md,
  },
  themeOptionDivider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  settingChevron: {
    marginLeft: SPACING.sm,
  },
  chevronText: {
    ...TYPOGRAPHY.h2,
  },
});
