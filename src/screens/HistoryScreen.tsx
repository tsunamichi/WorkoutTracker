import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Reanimated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SPACING, TYPOGRAPHY } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { BackTextButton } from '../components/common/BackTextButton';
import { HistoryTabBar } from '../components/history/HistoryTabBar';
import { LastFourWeeksHistoryTab } from '../components/history/LastFourWeeksHistoryTab';
import { WeightProgressTab } from '../components/history/WeightProgressTab';
import { ExportHistorySheet } from '../components/history/ExportHistorySheet';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getAppThemeFromStore } from '../theme/getAppThemeFromStore';
import { useTranslation } from '../i18n/useTranslation';
import type { HistoryTabId } from '../types/exerciseWeightProgress';
import {
  SCHEDULE_DECK_T,
  SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START,
  useScheduleDeckTransition,
} from '../context/ScheduleDeckTransitionContext';

type HistoryNavProp = NativeStackNavigationProp<RootStackParamList, 'History'>;
type HistoryRouteProp = RouteProp<RootStackParamList, 'History'>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const route = useRoute<HistoryRouteProp>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useAppTheme();
  const { t } = useTranslation();

  const initialTab: HistoryTabId = route.params?.initialTab ?? 'last4Weeks';
  const [activeTab, setActiveTab] = useState<HistoryTabId>(initialTab);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const last4WeeksScrollRef = useRef<ScrollView>(null);
  const last4WeeksScrollY = useRef(0);

  useEffect(() => {
    setActiveTab(route.params?.initialTab ?? 'last4Weeks');
  }, [route.params?.initialTab]);

  const transitionSource = route.params?.transitionSource;
  const isScheduleOriginTransition = transitionSource === 'scheduleDeck';
  const {
    progress: scheduleDeckProgressSV,
    reset: resetScheduleDeckTransition,
    startReverseTransition: startScheduleDeckReverseTransition,
  } = useScheduleDeckTransition();
  const scheduleDeckTransitionActiveSV = useSharedValue(isScheduleOriginTransition ? 1 : 0);
  const allowScheduleDeckPopRef = useRef(false);
  const isClosingFromHeaderRef = useRef(false);

  useEffect(() => {
    scheduleDeckTransitionActiveSV.value = isScheduleOriginTransition ? 1 : 0;
  }, [isScheduleOriginTransition, scheduleDeckTransitionActiveSV]);

  const scheduleDeckIncomingShellStyle = useAnimatedStyle(() => {
    if (scheduleDeckTransitionActiveSV.value === 0) {
      return {};
    }
    const p = scheduleDeckProgressSV.value;
    const opacity = interpolate(p, [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inOpacityEnd], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(
      p,
      [SCHEDULE_DECK_T.inStart, SCHEDULE_DECK_T.inEnd],
      [SCHEDULE_DECK_EXECUTION_INCOMING_SCALE_START, 1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  const runCloseToScheduleCard = useCallback(() => {
    if (!isScheduleOriginTransition) {
      navigation.goBack();
      return;
    }
    if (isClosingFromHeaderRef.current) {
      allowScheduleDeckPopRef.current = true;
      navigation.goBack();
      return;
    }
    isClosingFromHeaderRef.current = true;
    startScheduleDeckReverseTransition(finished => {
      if (!finished) {
        isClosingFromHeaderRef.current = false;
        return;
      }
      allowScheduleDeckPopRef.current = true;
      navigation.goBack();
      resetScheduleDeckTransition();
    });
  }, [isScheduleOriginTransition, navigation, resetScheduleDeckTransition, startScheduleDeckReverseTransition]);

  useEffect(() => {
    if (!isScheduleOriginTransition) return undefined;
    return navigation.addListener('beforeRemove', e => {
      if (allowScheduleDeckPopRef.current) {
        allowScheduleDeckPopRef.current = false;
        return;
      }
      e.preventDefault();
      isClosingFromHeaderRef.current = true;
      startScheduleDeckReverseTransition(finished => {
        if (!finished) {
          isClosingFromHeaderRef.current = false;
          return;
        }
        allowScheduleDeckPopRef.current = true;
        navigation.dispatch(e.data.action);
        resetScheduleDeckTransition();
      });
    });
  }, [isScheduleOriginTransition, navigation, resetScheduleDeckTransition, startScheduleDeckReverseTransition]);

  const onPressBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runCloseToScheduleCard();
  }, [runCloseToScheduleCard]);

  const handleTabChange = useCallback((tab: HistoryTabId) => {
    setActiveTab(tab);
  }, []);

  const handleOpenExport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExportSheetVisible(true);
  }, []);

  const scrollViewProps = useMemo(
    () => ({
      scrollEnabled,
      showsVerticalScrollIndicator: false as const,
      contentContainerStyle: [styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxxl }],
    }),
    [scrollEnabled, insets.bottom],
  );

  return (
    <Reanimated.View
      style={[
        styles.screen,
        { paddingTop: insets.top, backgroundColor: themeColors.canvasLight },
        isScheduleOriginTransition && scheduleDeckIncomingShellStyle,
      ]}
    >
      <StatusBar style="dark" />

      <BackTextButton
        label="Home"
        chevronPointsLeft
        onPress={onPressBack}
        textStyle={{ color: themeColors.textMeta }}
      />

      <View style={styles.headerBlock}>
        <Text style={[styles.titlePrimary, { color: themeColors.containerPrimary }]}>{t('history')}</Text>
        <HistoryTabBar
          activeTab={activeTab}
          onChange={handleTabChange}
          last4WeeksLabel={t('historyTabLast4Weeks')}
          progressLabel={t('historyTabProgress')}
        />
      </View>

      {activeTab === 'last4Weeks' ? (
        <ScrollView
          ref={last4WeeksScrollRef}
          style={styles.scroll}
          {...scrollViewProps}
          onScroll={e => {
            last4WeeksScrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <LastFourWeeksHistoryTab
            exportHistoryLabel={t('historyExportLink')}
            onPressExportHistory={handleOpenExport}
          />
        </ScrollView>
      ) : (
        <View style={styles.weightTabContainer}>
          <WeightProgressTab
            onScrollEnabledChange={setScrollEnabled}
            listScrollEnabled={scrollEnabled}
            contentPaddingBottom={insets.bottom + SPACING.xxxl}
            horizontalPadding={SPACING.xxl}
          />
        </View>
      )}

      <ExportHistorySheet visible={exportSheetVisible} onClose={() => setExportSheetVisible(false)} />
    </Reanimated.View>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  headerBlock: {
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.sm,
  },
  titlePrimary: {
    ...TYPOGRAPHY.displayLarge,
  },
  weightTabContainer: {
    flex: 1,
  },
});
