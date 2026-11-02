import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, space, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Tab screens leave the bottom edge to the tab bar. */
  edges?: Edge[];
  /** Let the content use the full window width (the wide week table). */
  wide?: boolean;
};

/** App background, safe areas, and a comfortable max width on big screens. */
export function Screen({ children, scroll = true, edges = ['top'], wide = false }: Props) {
  const { colors } = useTheme();
  // On the web this is the page's main landmark.
  const body = (
    <View style={[styles.content, wide && styles.wide]} role="main">
      {children}
    </View>
  );
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={edges}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
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
});
