import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mixVec3, scaleVec3, type BgThemeProps, type Vec3 } from '@/lib/backgrounds/themeProps'

/**
 * FloatingLines — soft horizontal light lines drifting through depth.
 * Colors are sampled between the theme's primary and secondary, and the
 * backdrop is the theme background, so the whole layer re-tints live
 * when the theme changes.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uSoftness;

void main() {
  // fade at both horizontal ends and soften vertically
  float fx = smoothstep(0.0, uSoftness, vUv.x) * smoothstep(1.0, 1.0 - uSoftness, vUv.x);
  float fy = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
  gl_FragColor = vec4(uColor, uAlpha * fx * fy);
}
`

interface LineSpec { y: number; h: number; speed: number; x0: number; color: Vec3; alpha: number; softness: number }

function Line({ spec }: { spec: LineSpec }) {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Vector3(...spec.color) },
      uAlpha: { value: spec.alpha },
      uSoftness: { value: spec.softness },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec],
  )
  useFrame((state) => {
    if (!mesh.current) return
    const t = state.clock.elapsedTime
    // drift and wrap across slightly more than the visible span
    const span = 3.2
    let x = ((spec.x0 + t * spec.speed) % span + span) % span
    mesh.current.position.x = x - span / 2
  })
  return (
    <mesh ref={mesh} position={[0, spec.y, 0]}>
      <planeGeometry args={[2.6, spec.h]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthTest={false} depthWrite={false} />
    </mesh>
  )
}

function Scene({ specs }: { specs: LineSpec[] }) {
  return (
    <>
      {specs.map((s, i) => (
        <Line key={i} spec={s} />
      ))}
    </>
  )
}

export default function FloatingLines({ theme, intensity = 0.55 }: { theme: BgThemeProps; intensity?: number }) {
  const specs = useMemo<LineSpec[]>(() => {
    const count = 15
    const out: LineSpec[] = []
    for (let i = 0; i < count; i++) {
      const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
      const r2 = Math.abs(Math.sin(i * 78.233) * 12543.21) % 1
      const depth = r1 // pseudo-depth
      const tint = mixVec3(theme.primary, theme.secondary, r2)
      out.push({
        y: -1 + (2 * (i + 0.5)) / count + (r2 - 0.5) * 0.06,
        h: 0.006 + depth * 0.02,
        speed: (0.04 + r1 * 0.12) * (r2 > 0.5 ? 1 : -1),
        x0: r1 * 3.2,
        color: theme.isLight ? mixVec3(tint, scaleVec3(theme.bg, 0.4), 0.25) : tint,
        alpha: (0.08 + depth * 0.3) * intensity,
        softness: 0.25 + r1 * 0.2,
      })
    }
    return out
  }, [theme, intensity])

  return (
    <div className="absolute inset-0" style={{ background: `rgb(${theme.bg.map((c) => Math.round(c * 255)).join(',')})` }} aria-hidden="true">
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 1] }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Scene specs={specs} />
      </Canvas>
    </div>
  )
}
