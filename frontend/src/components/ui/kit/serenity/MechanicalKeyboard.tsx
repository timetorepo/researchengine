// Serenity-style 3D mechanical keyboard, built with React Three Fiber.
// Keys press down when you type, and each press plays a synthesized click.
// Perspective: "Fixed" looks down at the board from the top; "Custom" lets you
// tilt and turn it with the sliders. Off by default (Settings).
//
// Design after Serenity UI's mechanical-keyboard component (ayushmxxn/serenity-ui)
// and the Work Louder keyboard it draws on. See the credits in Settings → About.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type Perspective = 'fixed' | 'custom'

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
]
const KEY = 0.82, GAP = 0.1

function playClick(ctx: AudioContext | null) {
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(2400 + Math.random() * 600, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.03)
  gain.gain.setValueAtTime(0.09, t)
  gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.06)
}

type KeyDef = { id: string; x: number; z: number; w: number }

function layoutKeys(): KeyDef[] {
  const keys: KeyDef[] = []
  ROWS.forEach((row, r) => {
    const offset = (ROWS[0].length - row.length) * (KEY + GAP) / 2 + r * 0.1
    row.forEach((k, c) => keys.push({ id: k, x: offset + c * (KEY + GAP) - (ROWS[0].length * (KEY + GAP)) / 2, z: r * (KEY + GAP) - 1.2, w: KEY }))
  })
  keys.push({ id: ' ', x: 0, z: 3 * (KEY + GAP) - 1.2 + KEY + GAP, w: 4.2 })
  return keys
}

function Keyboard({ pressed, perspective, tilt, rotation }: { pressed: Record<string, number>; perspective: Perspective; tilt: number; rotation: number }) {
  const group = useRef<THREE.Group>(null)
  const keys = useMemo(layoutKeys, [])
  const geo = useMemo(() => new THREE.BoxGeometry(1, 0.42, 1), [])
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9e7e2', roughness: 0.55, metalness: 0.05 }), [])
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.8 }), [])
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6C8EEF', roughness: 0.4 }), [])
  const keyRefs = useRef<Record<string, THREE.Mesh | null>>({})

  useFrame((_state, dt) => {
    const now = performance.now()
    for (const k of keys) {
      const m = keyRefs.current[k.id]
      if (!m) continue
      const t = pressed[k.id] ? Math.max(0, 1 - (now - pressed[k.id]) / 140) : 0
      m.position.y = 0.42 - t * 0.12
    }
    if (group.current) {
      const targetX = perspective === 'fixed' ? -0.95 : -tilt
      const targetY = perspective === 'fixed' ? 0 : rotation
      group.current.rotation.x += (targetX - group.current.rotation.x) * Math.min(1, dt * 8)
      group.current.rotation.y += (targetY - group.current.rotation.y) * Math.min(1, dt * 8)
    }
  })

  return (
    <group ref={group} rotation={[-0.95, 0, 0]}>
      <mesh position={[0, -0.25, 0.3]} material={baseMat} scale={[ROWS[0].length * (KEY + GAP) + 1, 0.5, 6.4]} geometry={geo} />
      <mesh position={[0, 0.02, 3.4]} material={accent} scale={[0.3, 0.05, 0.6]} geometry={geo} />
      {keys.map((k) => (
        <mesh key={k.id} ref={(el) => { keyRefs.current[k.id] = el }}
          position={[k.x, 0.42, k.z]} material={capMat} geometry={geo}
          scale={[k.w, 1, KEY]} />
      ))}
    </group>
  )
}

export function MechanicalKeyboard({ perspective = 'fixed', tilt = 0.6, rotation = 0, height = 180, sound = true }: {
  perspective?: Perspective; tilt?: number; rotation?: number; height?: number; sound?: boolean
}) {
  const [pressed, setPressed] = useState<Record<string, number>>({})
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const id = e.key === ' ' ? ' ' : e.key.length === 1 ? e.key.toUpperCase() : ''
      if (!id) return
      setPressed((p) => ({ ...p, [id]: performance.now() }))
      if (sound) {
        if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext()
        playClick(audio.current)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [sound])

  return (
    <div style={{ height, width: '100%' }} aria-label="3D mechanical keyboard" role="img">
      <Canvas camera={{ position: [0, 9, 4.5], fov: 34 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 8, 5]} intensity={1.1} />
        <Keyboard pressed={pressed} perspective={perspective} tilt={tilt} rotation={rotation} />
      </Canvas>
    </div>
  )
}
