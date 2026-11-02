import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { axisStep, columnPath, niceMax } from '@/timecard/charts';
import { formatHours } from '@/timecard/dates';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

export type ChartSegment = { value: number; color: string };

/** One line of a column's breakdown. A colour shows a matching swatch. */
export type ChartDetailRow = { label: string; value: string; color?: string };

export type ChartBar = {
  key: string;
  /** Under the column ("Mon", "1/7"). */
  label: string;
  /** A second line under the label, for short ranges. */
  sub?: string;
  /** Stacked bottom to top. Zero parts are skipped. */
  segments: ChartSegment[];
  /** The breakdown shown on tap or hover, and read by screen readers. */
  title: string;
  note?: string;
  rows: ChartDetailRow[];
  footer?: string;
};

export type LegendItem = { label: string; color: string; dashed?: boolean };

type Props = {
  title: string;
  bars: ChartBar[];
  /** Dashed reference line (required hours, weekly target). */
  reference: number;
  legend: LegendItem[];
  /** Show the value above every column (otherwise only when there are 10 or fewer). */
  allValues?: boolean;
  emptyText?: string;
};

// Chart rules from the HTML page (CLAUDE.md §3.5).
const HEIGHT = 240;
const PAD = { left: 34, right: 8, top: 18 };
const MAX_COLUMN = 24;
const STACK_GAP = 2;
const TIP_WIDTH = 210;
// SVG text doesn't inherit the page font on the web; native uses the system font already.
const FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

/** "8", "8.5", "8.25": hours without trailing zeros, for labels on the chart. */
const short = (v: number) => formatHours(v).replace(/\.?0+$/, '');

/**
 * Thin stacked columns with a dashed reference line, drawn with
 * react-native-svg. Tap (phone) or hover (web) a column for its breakdown.
 */
export function ColumnChart({
  title,
  bars,
  reference,
  legend,
  allValues = false,
  emptyText = 'No days in this range',
}: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  // The column under the mouse (web). A click there keeps the breakdown open.
  const hovered = useRef<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const twoLine = bars.some((b) => b.sub);
  const padBottom = twoLine ? 34 : 22;
  const totals = bars.map((b) => b.segments.reduce((sum, s) => sum + s.value, 0));
  const max = niceMax(Math.max(reference, ...totals, 0));
  const step = axisStep(max);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - padBottom;
  const band = innerW / Math.max(1, bars.length);
  const colW = Math.max(3, Math.min(MAX_COLUMN, band * 0.62));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery =
    bars.length <= 10
      ? 1
      : Math.ceil(bars.length / Math.max(1, Math.floor(innerW / (twoLine ? 44 : 52))));
  const showValues = allValues || bars.length <= 10;

  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);

  const shown = active != null && active < bars.length ? active : null;
  const tip = shown != null ? bars[shown] : null;
  const tipLeft =
    shown != null
      ? (() => {
          const cx = PAD.left + band * shown + band / 2;
          const right = cx + band / 2 + space.sm;
          if (right + TIP_WIDTH <= width) return right;
          return Math.max(0, cx - band / 2 - space.sm - TIP_WIDTH);
        })()
      : 0;

  return (
    <View style={styles.root}>
      <AppText variant="bodyStrong" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            {item.dashed ? (
              <View style={[styles.dash, { borderColor: item.color }]} />
            ) : (
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
            )}
            <AppText variant="caption" tone="muted">
              {item.label}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ height: HEIGHT }} onLayout={onLayout} testID={`chart: ${title}`}>
        {width > 0 ? (
          <>
            <Svg
              width={width}
              height={HEIGHT}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              {ticks.map((v) => (
                <Line
                  key={`g${v}`}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={colors.chart.grid}
                  strokeWidth={1}
                />
              ))}
              {ticks.map((v) => (
                <SvgText
                  key={`t${v}`}
                  x={PAD.left - 6}
                  y={y(v) + 4}
                  fontSize={11}
                  fontFamily={FONT}
                  fill={colors.textMuted}
                  textAnchor="end">
                  {String(v)}
                </SvgText>
              ))}
              {shown != null ? (
                <Rect
                  x={PAD.left + band * shown}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill={colors.accent}
                  fillOpacity={0.1}
                />
              ) : null}
              {bars.map((bar, i) => {
                const cx = PAD.left + band * i + band / 2;
                const x = cx - colW / 2;
                const parts = bar.segments.filter((s) => s.value > 0);
                let below = 0;
                return (
                  <G key={bar.key}>
                    {parts.map((s, j) => {
                      const top = y(below + s.value);
                      // A 2 px gap of background between stacked parts.
                      const bottom = y(below) - (j > 0 ? STACK_GAP : 0);
                      below += s.value;
                      const d = columnPath(x, top, colW, bottom - top, j === parts.length - 1);
                      return d ? <Path key={j} d={d} fill={s.color} /> : null;
                    })}
                    {showValues && totals[i] > 0 ? (
                      <SvgText
                        x={cx}
                        y={y(totals[i]) - 5}
                        fontSize={11}
                        fontFamily={FONT}
                        fontWeight="600"
                        fill={colors.text}
                        textAnchor="middle">
                        {short(totals[i])}
                      </SvgText>
                    ) : null}
                    {i % labelEvery === 0 ? (
                      <SvgText
                        x={cx}
                        y={HEIGHT - padBottom + 14}
                        fontSize={11}
                        fontFamily={FONT}
                        fill={colors.textMuted}
                        textAnchor="middle">
                        {bar.label}
                      </SvgText>
                    ) : null}
                    {bar.sub && i % labelEvery === 0 ? (
                      <SvgText
                        x={cx}
                        y={HEIGHT - padBottom + 27}
                        fontSize={11}
                        fontFamily={FONT}
                        fill={colors.textMuted}
                        textAnchor="middle">
                        {bar.sub}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
              {reference > 0 ? (
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(reference)}
                  y2={y(reference)}
                  stroke={colors.chart.reference}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              ) : null}
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(0)}
                y2={y(0)}
                stroke={colors.textMuted}
                strokeWidth={1}
              />
              {!bars.length ? (
                <SvgText
                  x={width / 2}
                  y={HEIGHT / 2}
                  fontSize={13}
                  fontFamily={FONT}
                  fill={colors.textMuted}
                  textAnchor="middle">
                  {emptyText}
                </SvgText>
              ) : null}
            </Svg>

            {/* One tap/hover target per column, the full height of the chart. */}
            {bars.map((bar, i) => (
              <Pressable
                key={bar.key}
                accessibilityRole="button"
                accessibilityLabel={[
                  bar.title,
                  bar.note,
                  ...bar.rows.map((r) => `${r.label} ${r.value}`),
                  bar.footer,
                ]
                  .filter(Boolean)
                  .join('. ')
                  .replace('✓ ', '')}
                onPress={() => setActive((a) => (a === i && hovered.current !== i ? null : i))}
                onHoverIn={() => {
                  hovered.current = i;
                  setActive(i);
                }}
                onHoverOut={() => {
                  hovered.current = null;
                  setActive((a) => (a === i ? null : a));
                }}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                style={[
                  styles.hit,
                  { left: PAD.left + band * i, top: PAD.top, width: band, height: innerH },
                ]}
              />
            ))}

            {tip ? (
              <View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.tip,
                  {
                    left: tipLeft,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: '#000',
                  },
                ]}>
                <AppText variant="label">{tip.title}</AppText>
                {tip.note ? (
                  <AppText variant="caption" tone="muted">
                    {tip.note}
                  </AppText>
                ) : null}
                {tip.rows.map((r) => (
                  <View key={r.label} style={styles.tipRow}>
                    <View style={styles.tipLabel}>
                      {r.color ? (
                        <View style={[styles.tipSwatch, { backgroundColor: r.color }]} />
                      ) : null}
                      <AppText variant="caption">{r.label}</AppText>
                    </View>
                    <AppText variant="caption" style={styles.tipValue}>
                      {r.value}
                    </AppText>
                  </View>
                ))}
                {tip.footer ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={[styles.tipFooter, { borderColor: colors.border }]}>
                    {tip.footer}
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  dash: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  hit: { position: 'absolute' },
  tip: {
    position: 'absolute',
    top: PAD.top,
    width: TIP_WIDTH,
    gap: 2,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  tipLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  tipSwatch: { width: 9, height: 9, borderRadius: 2 },
  tipValue: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  tipFooter: { borderTopWidth: 1, marginTop: 2, paddingTop: 2 },
});
