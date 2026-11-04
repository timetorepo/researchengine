/*
 * Counter, from React Bits by David Hyde (DavidHDev/react-bits, MIT).
 * Ported to TypeScript for this app; the animation and layout are unchanged.
 * Each digit is a column of 0–9 that springs to the right one.
 */
import { motion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect, type CSSProperties } from 'react'
import './Counter.css'

function NumberSlot({ mv, number, height }: { mv: MotionValue<number>; number: number; height: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10
    const offset = (10 + number - placeValue) % 10
    let memo = offset * height
    if (offset > 5) memo -= 10 * height
    return memo
  })
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  )
}

function normalizeNearInteger(num: number) {
  const nearest = Math.round(num)
  const tolerance = 1e-9 * Math.max(1, Math.abs(num))
  return Math.abs(num - nearest) < tolerance ? nearest : num
}

function getValueRoundedToPlace(value: number, place: number) {
  return Math.floor(normalizeNearInteger(value / place))
}

function Digit({ place, value, height, digitStyle }: { place: number | '.'; value: number; height: number; digitStyle?: CSSProperties }) {
  const isDecimal = place === '.'
  const valueRoundedToPlace = isDecimal ? 0 : getValueRoundedToPlace(value, place)
  const animatedValue = useSpring(valueRoundedToPlace)

  useEffect(() => {
    if (!isDecimal) animatedValue.set(valueRoundedToPlace)
  }, [animatedValue, valueRoundedToPlace, isDecimal])

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, ...digitStyle, width: 'fit-content' }}>
        .
      </span>
    )
  }
  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <NumberSlot key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  )
}

export interface CounterProps {
  value: number
  fontSize?: number
  padding?: number
  gap?: number
  borderRadius?: number
  horizontalPadding?: number
  textColor?: string
  fontWeight?: CSSProperties['fontWeight']
  gradientHeight?: number
  gradientFrom?: string
  gradientTo?: string
  containerStyle?: CSSProperties
  counterStyle?: CSSProperties
  digitStyle?: CSSProperties
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
}: CounterProps) {
  const height = fontSize + padding
  const places = [...value.toString()].map((ch, i, a) => {
    if (ch === '.') return '.' as const
    const dot = a.indexOf('.')
    return 10 ** (dot === -1 ? a.length - i - 1 : i < dot ? dot - i - 1 : -(i - dot))
  })
  return (
    <span className="counter-container" style={containerStyle}>
      <span
        className="counter-counter"
        style={{
          fontSize, gap, borderRadius,
          paddingLeft: horizontalPadding, paddingRight: horizontalPadding,
          color: textColor, fontWeight, direction: 'ltr',
          ...counterStyle,
        }}
      >
        {places.map((place, i) => (
          <Digit key={i} place={place} value={value} height={height} digitStyle={digitStyle} />
        ))}
      </span>
      <span className="gradient-container">
        <span className="top-gradient" style={{ height: gradientHeight, background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})` }} />
        <span className="bottom-gradient" style={{ height: gradientHeight, background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})` }} />
      </span>
    </span>
  )
}
