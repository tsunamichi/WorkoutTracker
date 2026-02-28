import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../../constants';
import { IconPlay, IconCheckmark, IconChevronDown } from '../icons';
import type { CoreSetTemplate } from '../../types/training';

const CARD_MARGIN_H = 20;
const CARD_GAP_V = 12;

export type CoreProgramTimelineProps = {
  sessions: CoreSetTemplate[];
  upNextIndex: number;
  sessionsPerWeek?: number;
  onStartSession: (session: CoreSetTemplate, isUpNext: boolean) => void;
  isSessionCompleted: (sessionId: string) => boolean;
  isSessionSkipped: (sessionId: string) => boolean;
  startLabel?: string;
};

type WeekGroup = { weekIndex: number; sessions: CoreSetTemplate[] };

function SessionCard({
  session,
  isUpNext,
  onStartSession,
  isSessionCompleted,
  isSessionSkipped,
  startLabel,
}: {
  session: CoreSetTemplate;
  isUpNext: boolean;
  onStartSession: (s: CoreSetTemplate, isUpNext: boolean) => void;
  isSessionCompleted: (id: string) => boolean;
  isSessionSkipped: (id: string) => boolean;
  startLabel: string;
}) {
  const completed = isSessionCompleted(session.id);
  const skipped = isSessionSkipped(session.id);
  const showDetails = isUpNext && !completed;
  const exerciseCount = session.items?.length ?? 0;

  return (
    <TouchableOpacity
      style={[CARDS.cardDeepDimmed.outer, styles.touchCard]}
      onPress={() => onStartSession(session, isUpNext)}
      activeOpacity={0.85}
    >
      <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner, !showDetails && styles.cardInnerCollapsed]}>
        <View style={styles.cardContent}>
          {completed && (
            <View style={styles.stateIconAbsolute} pointerEvents="none">
              <IconCheckmark size={18} color={COLORS.successBright} />
            </View>
          )}
          <Text
            style={[
              showDetails ? styles.cardTitle : styles.cardTitleCollapsed,
              skipped && styles.cardTitleSkipped,
            ]}
            numberOfLines={1}
          >
            {session.name}
          </Text>
          {showDetails ? (
            <>
              <View style={styles.exerciseList}>
                {session.items.slice(0, 3).map(item => (
                  <Text
                    key={item.id}
                    style={styles.exerciseName}
                    numberOfLines={1}
                  >
                    {item.movementId}
                  </Text>
                ))}
              </View>
              {skipped && (
                <View style={styles.footer}>
                  <Text style={styles.skippedLabel}>Skipped</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.exerciseCount} numberOfLines={1}>
              {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            </Text>
          )}
        </View>
        {showDetails && !completed && !skipped && (
          <TouchableOpacity
            onPress={() => onStartSession(session, isUpNext)}
            style={[
              styles.startButtonBar,
              isUpNext ? styles.startButtonBarPrimary : styles.startButtonBarSecondary,
            ]}
            activeOpacity={1}
          >
            <Text
              style={[
                styles.startButtonBarText,
                isUpNext ? styles.startButtonBarTextPrimary : styles.startButtonBarTextSecondary,
              ]}
            >
              {startLabel}
            </Text>
            <IconPlay
              size={16}
              color={isUpNext ? COLORS.backgroundCanvas : COLORS.accentPrimary}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function CoreProgramTimeline({
  sessions,
  upNextIndex,
  sessionsPerWeek = 3,
  onStartSession,
  isSessionCompleted,
  isSessionSkipped,
  startLabel = 'Start',
}: CoreProgramTimelineProps) {
  const { width: screenWidth } = useWindowDimensions();

  const weekGroups: WeekGroup[] = useMemo(() => {
    const w1 = sessions.slice(0, sessionsPerWeek);
    const w2 = sessions.slice(sessionsPerWeek, 2 * sessionsPerWeek);
    const groups: WeekGroup[] = [];
    if (w1.length > 0) groups.push({ weekIndex: 0, sessions: w1 });
    if (w2.length > 0) groups.push({ weekIndex: 1, sessions: w2 });
    return groups;
  }, [sessions, sessionsPerWeek]);

  const activeWeekIndex = Math.min(
    Math.floor(upNextIndex / sessionsPerWeek),
    weekGroups.length - 1
  );

  const [expandedWeeks, setExpandedWeeks] = useState<boolean[]>(() =>
    weekGroups.map((_, i) => i === activeWeekIndex)
  );

  const toggleWeek = useCallback((weekIndex: number) => {
    setExpandedWeeks(prev => {
      const next = [...prev];
      next[weekIndex] = !next[weekIndex];
      return next;
    });
  }, []);

  if (sessions.length === 0 || weekGroups.length === 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, { width: screenWidth }]}>
      {weekGroups.map((group) => {
        const isExpanded = expandedWeeks[group.weekIndex] ?? false;
        return (
          <View key={`week-${group.weekIndex}`} style={styles.weekCard}>
            <TouchableOpacity
              style={styles.weekRow}
              onPress={() => toggleWeek(group.weekIndex)}
              activeOpacity={0.7}
            >
              <Text style={styles.weekRowLabel}>Week {group.weekIndex + 1}</Text>
              <View style={styles.weekRowValue}>
                <Text style={styles.weekRowValueText}>
                  {group.sessions.length} workout{group.sessions.length !== 1 ? 's' : ''}
                </Text>
                <View style={[styles.chevronWrap, isExpanded && styles.chevronWrapRotated]}>
                  <IconChevronDown size={20} color={COLORS.text} />
                </View>
              </View>
            </TouchableOpacity>
            {isExpanded && (
              <View style={styles.weekContent}>
                {group.sessions.map((session, i) => {
                  const globalIndex = group.weekIndex * sessionsPerWeek + i;
                  const isUpNext = globalIndex === upNextIndex;
                  return (
                    <View key={session.id} style={styles.sessionCardWrap}>
                      <SessionCard
                        session={session}
                        isUpNext={isUpNext}
                        onStartSession={onStartSession}
                        isSessionCompleted={isSessionCompleted}
                        isSessionSkipped={isSessionSkipped}
                        startLabel={startLabel}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: CARD_MARGIN_H,
    paddingBottom: SPACING.lg,
  },
  weekCard: {
    marginBottom: SPACING.md,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
  },
  weekRowLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  weekRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  weekRowValueText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  chevronWrap: {
    transform: [{ rotate: '0deg' }],
  },
  chevronWrapRotated: {
    transform: [{ rotate: '180deg' }],
  },
  weekContent: {
    marginTop: 0,
    paddingTop: SPACING.md,
  },
  sessionCardWrap: {
    marginBottom: CARD_GAP_V,
  },
  touchCard: {
    width: '100%',
  },
  cardInner: {
    paddingTop: SPACING.lg,
    paddingHorizontal: 4,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  cardInnerCollapsed: {
    paddingBottom: 20,
  },
  cardContent: {
    paddingHorizontal: 20,
    position: 'relative',
  },
  stateIconAbsolute: {
    position: 'absolute',
    top: 0,
    right: 20,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 8,
  },
  cardTitleCollapsed: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardTitleSkipped: {
    opacity: 0.6,
  },
  exerciseCount: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  exerciseList: {},
  exerciseName: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 2,
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  skippedLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  startButtonBar: {
    width: '100%',
    height: 48,
    marginTop: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  startButtonBarPrimary: {
    backgroundColor: COLORS.accentPrimary,
  },
  startButtonBarSecondary: {
    backgroundColor: 'transparent',
  },
  startButtonBarText: {
    ...TYPOGRAPHY.metaBold,
  },
  startButtonBarTextPrimary: {
    color: COLORS.backgroundCanvas,
  },
  startButtonBarTextSecondary: {
    color: COLORS.accentPrimary,
  },
});
