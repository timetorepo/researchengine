import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mixVec3, scaleVec3, type BgThemeProps, type Vec3 } from '@/lib/backgrounds/themeProps'

/**
 * DarkVeil — slowly flowing dark smoke rendered with an fbm noise shader.
 * Colors adapt to the active theme: a deepened theme background folded with
 * a trace of the theme primary, so the veil reads as part of the palette.
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
uniform float uIntensity;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  float t = uTime * 0.045;
  vec2 uv = vUv * vec2(2.6, 1.8);
  float n1 = fbm(uv + vec2(t, -t * 0.6));
  float n2 = fbm(uv * 1.9 - vec2(t * 1.4, t * 0.5) + n1 * 0.8);
  float veil = smoothstep(-0.4, 0.9, n1 * 0.55 + n2 * 0.45);
  vec3 col = mix(uColorA, uColorB, veil);
  col *= mix(0.82, 1.06, vUv.y); // softly darker toward the bottom
  gl_FragColor = vec4(col, uIntensity);
}
`

function VeilPlane({ a, b, intensity }: { a: Vec3; b: Vec3; intensity: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Vector3(...a) },
      uColorB: { value: new THREE.Vector3(...b) },
      uIntensity: { value: intensity },
    }),
    // rebuild uniforms when the palette changes (theme switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.join(','), b.join(','), intensity],
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

export default function DarkVeil({ theme, intensity = 0.6 }: { theme: BgThemeProps; intensity?: number }) {
  // deepened theme bg + a faint primary-tinted smoke
  const a = useMemo(() => scaleVec3(theme.bg, theme.isLight ? 0.92 : 0.62), [theme])
  const b = useMemo(() => mixVec3(scaleVec3(theme.bg, theme.isLight ? 0.8 : 0.9), theme.primary, 0.16), [theme])
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 1] }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <VeilPlane a={a} b={b} intensity={Math.min(1, intensity + 0.15)} />
      </Canvas>
    </div>
  )
}
