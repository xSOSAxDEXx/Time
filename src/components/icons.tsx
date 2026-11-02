import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: ColorValue; size?: number };

const stroke = (color: ColorValue) =>
  ({
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  }) as const;

/** Week tab: a calendar page. */
export function CalendarIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Rect x={3} y={5} width={18} height={16} rx={2} {...stroke(color)} />
      <Path d="M3 10h18M8 3v4M16 3v4" {...stroke(color)} />
    </Svg>
  );
}

/** Summary tab: a list. */
export function ListIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M9 6h11M9 12h11M9 18h11" {...stroke(color)} />
      <Circle cx={4.5} cy={6} r={1.2} fill={color} />
      <Circle cx={4.5} cy={12} r={1.2} fill={color} />
      <Circle cx={4.5} cy={18} r={1.2} fill={color} />
    </Svg>
  );
}

/** Charts tab: columns. */
export function ChartIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" {...stroke(color)} />
    </Svg>
  );
}

/** Settings tab: sliders. */
export function SlidersIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...stroke(color)} />
      <Circle cx={16} cy={7} r={2} {...stroke(color)} />
      <Circle cx={10} cy={17} r={2} {...stroke(color)} />
    </Svg>
  );
}
