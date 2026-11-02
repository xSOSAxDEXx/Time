import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, space, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Tab screens leave the bottom edge to the tab bar. */
  edges?: Edge[];
  /** Let the content use the full window width (the wide week table). */
  wide?: boolean;
  /** Pinned below the content, within thumb reach (the clock buttons). */
  footer?: ReactNode;
  /** For screens that scroll to a spot (Settings' "Jump to" links). */
  scrollRef?: Ref<ScrollViewInstance>;
};

/** App background, safe areas, and a comfortable max width on big screens. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  wide = false,
  footer,
  scrollRef,
}: Props) {
  const { colors } = useTheme();
  // On the web this is the page's main landmark.
  const body = (
    <View style={[styles.content, wide && styles.wide]} role="main">
      {children}
    </View>
  );
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={edges}>
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? <View style={[styles.footer, wide && styles.wide]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  wide: { maxWidth: 1920 },
  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
