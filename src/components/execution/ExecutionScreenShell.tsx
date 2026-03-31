import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconArrowLeft, IconMenu } from '../icons';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { EXPLORE_V2 } from '../exploreV2/exploreV2Tokens';

type Props = {
  title: string;
  pageBackground: string;
  headerInk: string;
  onBack: () => void;
  onMenu: () => void;
  hero: React.ReactNode;
  children: React.ReactNode;
};

export function ExecutionScreenShell({
  title,
  pageBackground,
  headerInk,
  onBack,
  onMenu,
  hero,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: pageBackground, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
            <IconArrowLeft size={24} color={headerInk} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: headerInk }]}>
              {title}
            </Text>
          </View>
          <TouchableOpacity onPress={onMenu} style={styles.menuButton} activeOpacity={0.8}>
            <IconMenu size={24} color={headerInk} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.contentWrap, { backgroundColor: pageBackground }]}>
        <View style={styles.root}>
          <View style={styles.bandsColumn}>
            <View style={styles.timerBand}>{hero}</View>
            <View style={styles.walletBand}>{children}</View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -4,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    minWidth: 0,
  },
  headerTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    letterSpacing: -0.35,
    lineHeight: 28,
    opacity: 0.94,
    textAlign: 'center',
    width: '100%',
  },
  contentWrap: {
    flex: 1,
  },
  root: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'visible',
    minHeight: 0,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  bandsColumn: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    zIndex: 10,
    elevation: 2,
  },
  timerBand: {
    flex: EXPLORE_V2.layout.restTimerHeightFraction,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletBand: {
    flex: EXPLORE_V2.layout.restStackHeightFraction,
    minHeight: 0,
    overflow: 'visible',
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
});

