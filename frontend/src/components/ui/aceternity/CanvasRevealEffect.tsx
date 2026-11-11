/**
 * Canvas Reveal Effect — Aceternity UI, vendored (R16).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/canvas-reveal-effect-demo
 *
 * Source: strapi/LaunchPad → tanstack/src/components/ui/canvas-reveal-effect.tsx
 * (the same file adrianhajdin/portfolio carries as CanvasRevealEffect.tsx).
 * Provenance + upstream digest: frontend/scripts/aceternity-sources.json
 * (`node frontend/scripts/aceternity-vendor.mjs --verify` re-checks it).
 *
 * Local patches — upstream mounts a WebGL context and animates it forever:
 *   • `paused` (default true until it is on screen) stops the frame loop, so a
 *     hidden or scrolled-away effect costs nothing;
 *   • reduce-motion renders the dot field once, as a static grid, instead of
 *     running the shader at 60fps;
 *   • the white container is transparent, because this app's surfaces are
 *     theme-true and a white rounded box is a second palette;
 *   • it also stops while the window is hidden, and freezes to the static grid
 *     when the adaptive-quality governor (lib/system/frame-budget) reports a
 *     machine that cannot hold frames — a WebGL context is the first thing to
 *     cost real heat on a slow GPU.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three';
import { useFrameLevel } from '@/lib/system/frame-budget';

import { useReducedMotion } from 'motion/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { cn } from '@/lib/utils'

export const CanvasRevealEffect = ({
  animationSpeed = 0.4,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  paused,
}: {
  animationSpeed?: number;
  opacities?: Array<number>;
  colors?: Array<Array<number>>;
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  /** Stop the frame loop (default: run only while the element is on screen). */
  paused?: boolean;
}) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  const reduce = useReducedMotion()

  // Nothing animates off screen, and nothing animates at all under reduce-motion.
  useEffect(() => {
    const node = hostRef.current
    if (!node || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return }
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '120px' })
    io.observe(node)
    return () => io.disconnect()
  }, [])

  // A hidden window draws nothing, whatever the caller asked for.
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  /** Run only while on screen, visible, and on a machine that can hold frames. */
  const expensive = useFrameLevel() === 'minimal'
  const running = !reduce && visible && !expensive && !(paused ?? !onScreen)

  return (
    <div ref={hostRef} className={cn('relative h-full w-full bg-transparent', containerClassName)}>
      {reduce || expensive || !visible ? (
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `radial-gradient(${`rgba(${colors[0][0]},${colors[0][1]},${colors[0][2]},0.35)`} ${dotSize ?? 3}px, transparent ${dotSize ?? 3}px)`,
            backgroundSize: '14px 14px',
          }}
        />
      ) : (
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[0, 255, 255]]}
          dotSize={dotSize ?? 3}
          opacities={
            opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]
          }
          shader={`
              float animation_speed_factor = ${animationSpeed.toFixed(1)};
              float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);
              opacity *= step(intro_offset, u_time * animation_speed_factor);
              opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            `}
          center={['x', 'y']}
          paused={!running}
        />
      </div>
      )}
      {showGradient && !reduce && (
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-[84%]" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: Array<Array<number>>;
  opacities?: Array<number>;
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: Array<'x' | 'y'>;
}

const DotMatrix: React.FC<DotMatrixProps & { paused?: boolean }> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 4,
  dotSize = 2,
  shader = '',
  center = ['x', 'y'],
  paused = false,
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
    ];
    if (colors.length === 2) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[1],
      ];
    } else if (colors.length === 3) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[2],
        colors[2],
      ];
    }

    return {
      u_colors: {
        value: colorsArray.map((color) => [
          color[0] / 255,
          color[1] / 255,
          color[2] / 255,
        ]),
        type: 'uniform3fv',
      },
      u_opacities: {
        value: opacities,
        type: 'uniform1fv',
      },
      u_total_size: {
        value: totalSize,
        type: 'uniform1f',
      },
      u_dot_size: {
        value: dotSize,
        type: 'uniform1f',
      },
    };
  }, [colors, opacities, totalSize, dotSize]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        out vec4 fragColor;
        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }
        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        }
        void main() {
            vec2 st = fragCoord.xy;
            ${
              center.includes('x')
                ? 'st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));'
                : ''
            }
            ${
              center.includes('y')
                ? 'st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));'
                : ''
            }
      float opacity = step(0.0, st.x);
      opacity *= step(0.0, st.y);

      vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

      float frequency = 5.0;
      float show_offset = random(st2);
      float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency) + 1.0);
      opacity *= u_opacities[int(rand * 10.0)];
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

      vec3 color = u_colors[int(show_offset * 6.0)];

      ${shader}

      fragColor = vec4(color, opacity);
      fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={paused ? 0 : 60}
    />
  );
};

type Uniforms = {
  [key: string]: {
    value: Array<number> | Array<Array<number>> | number;
    type: string;
  };
};
const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
  paused = false,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  paused?: boolean;
  uniforms: Uniforms;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null!);
  let lastFrameTime = 0;

  useFrame(({ clock }) => {
    if (!ref.current || paused) return;
    const timestamp = clock.getElapsedTime();
    if (timestamp - lastFrameTime < 1 / maxFps) {
      return;
    }
    lastFrameTime = timestamp;

    const material: any = ref.current.material;
    const timeLocation = material.uniforms.u_time;
    timeLocation.value = timestamp;
  });

  const getUniforms = () => {
    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {
        case 'uniform1f':
          preparedUniforms[uniformName] = { value: uniform.value, type: '1f' };
          break;
        case 'uniform3f':
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: '3f',
          };
          break;
        case 'uniform1fv':
          preparedUniforms[uniformName] = { value: uniform.value, type: '1fv' };
          break;
        case 'uniform3fv':
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: Array<number>) =>
              new THREE.Vector3().fromArray(v)
            ),
            type: '3fv',
          };
          break;
        case 'uniform2f':
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: '2f',
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }

    preparedUniforms['u_time'] = { value: 0, type: '1f' };
    preparedUniforms['u_resolution'] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };

  const material = useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return materialObject;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60, paused = false }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} paused={paused} />
    </Canvas>
  );
};
interface ShaderProps {
  paused?: boolean;
  source: string;
  uniforms: {
    [key: string]: {
      value: Array<number> | Array<Array<number>> | number;
      type: string;
    };
  };
  maxFps?: number;
}
