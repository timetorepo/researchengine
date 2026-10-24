import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mixVec3, type BgThemeProps, type Vec3 } from '@/lib/backgrounds/themeProps'

/**
 * Dither — an animated wave quantized through an 8x8 Bayer matrix, so the
 * gradient breaks into crisp dither dots. Three tones from the active theme
 * (background, primary-tinted, secondary-tinted) keep it cohesive.
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
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uIntensity;

// Compact ordered 8x8 Bayer matrix (classic recursive construction)
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  float t = uTime * 0.35;
  vec2 uv = vUv;
  float wave =
    sin(uv.x * 7.0 + t) * 0.35 +
    sin(uv.y * 5.0 - t * 0.8) * 0.3 +
    sin((uv.x + uv.y) * 9.0 + t * 0.5) * 0.2;
  float v = smoothstep(-0.8, 0.8, wave + (uv.y - 0.5) * 0.6);

  float b = bayer8(gl_FragCoord.xy) - 0.5;
  float levels = 3.0;
  float q = clamp(floor(v * levels + b) / (levels - 1.0), 0.0, 1.0);

  vec3 col = q < 0.5
    ? mix(uColorA, uColorB, smoothstep(0.0, 0.5, q))
    : mix(uColorB, uColorC, smoothstep(0.5, 1.0, q));

  gl_FragColor = vec4(col, uIntensity);
}
`

function DitherPlane({ a, b, c, intensity }: { a: Vec3; b: Vec3; c: Vec3; intensity: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Vector3(...a) },
      uColorB: { value: new THREE.Vector3(...b) },
      uColorC: { value: new THREE.Vector3(...c) },
      uIntensity: { value: intensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.join(','), b.join(','), c.join(','), intensity],
  )
  useFrame((_, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value += delta
  })
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthTest={false} depthWrite={false} />
    </mesh>
  )
}

export default function Dither({ theme, intensity = 0.5 }: { theme: BgThemeProps; intensity?: number }) {
  const a = useMemo(() => theme.bg, [theme])
  const b = useMemo(() => mixVec3(theme.bg, theme.primary, theme.isLight ? 0.4 : 0.35), [theme])
  const c = useMemo(() => mixVec3(theme.bg, theme.secondary, theme.isLight ? 0.32 : 0.28), [theme])
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 1] }}
        dpr={[1, 1.25]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <DitherPlane a={a} b={b} c={c} intensity={Math.min(1, intensity + 0.3)} />
      </Canvas>
    </div>
  )
}
