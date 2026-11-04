'use client'

/**
 * Etched accretion: a black-hole background with an engraved disc in crimson
 * and silver line work, light jets, and contour nebulae that drift with the
 * pointer. Written for ResearchEngine after the look of the 21st.dev component
 * "Etched Accretion" by Kedhareswer Naidu (MIT). Its registry source could not
 * be fetched, so this is an independent shader, not a copy of that code.
 */
import { useEffect, useRef } from 'react'

const VERTEX = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 v_uv;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_flare;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }

  void main() {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = v_uv - 0.5;
    uv.x *= aspect;
    // the hole drifts a little toward the pointer
    vec2 drift = (u_mouse - 0.5) * vec2(aspect, 1.0) * 0.12;
    vec2 p = uv - drift;
    float t = u_time * 0.12;

    float r = length(p);
    float a = atan(p.y, p.x);

    // the disc is tilted: squash the y axis so the ring reads as a plane
    vec2 q = vec2(p.x, p.y * 2.6);
    float rq = length(q);
    float ring = smoothstep(0.52, 0.2, abs(rq - 0.42));
    float inner = smoothstep(0.27, 0.23, rq);       // event horizon: black
    float photon = exp(-pow((rq - 0.27) * 16.0, 2.0)) * 0.9;  // bright photon ring

    // engraved line work: contour lines of a swirling field, following the disc
    float swirl = a * 2.0 + 6.0 * rq - t * 3.0;
    float field = fbm(vec2(cos(swirl), sin(swirl)) * 1.4 + vec2(rq * 3.0, t));
    float lines = smoothstep(0.96, 0.99, abs(sin(field * 46.0)));

    // light jets along the pole
    float jet = exp(-pow(p.x * 9.0, 2.0)) * smoothstep(0.1, 0.9, abs(p.y)) * (0.5 + 0.5 * sin(p.y * 12.0 - t * 8.0));

    // contour nebula, faint, drifting
    float neb = fbm(p * 2.2 + vec2(t, -t * 0.7));
    float nebLines = smoothstep(0.97, 0.995, abs(sin(neb * 30.0)));

    vec3 crimson = vec3(0.86, 0.12, 0.16);
    vec3 silver = vec3(0.82, 0.84, 0.88);

    vec3 col = vec3(0.0);
    col += crimson * ring * (0.25 + 0.75 * lines);
    col += silver * ring * lines * 0.55;
    col += crimson * photon * (1.0 + u_flare * 0.8);
    col += silver * jet * 0.18 * (1.0 + u_flare);
    col += silver * nebLines * 0.12 * smoothstep(0.9, 0.2, rq);
    col += crimson * 0.05 * neb * smoothstep(1.0, 0.1, rq);
    col *= (1.0 - inner);

    // vignette and grain
    col *= smoothstep(1.1, 0.35, length(v_uv - 0.5) * 1.3);
    col += (hash(gl_FragCoord.xy + t) - 0.5) * 0.025;

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }
`

export interface EtchedAccretionProps {
  speed?: number
  opacity?: number
  className?: string
}

export function EtchedAccretion({ speed = 1, opacity = 1, className }: EtchedAccretionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null }
      return sh
    }
    const vs = compile(gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vs || !fs) return
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const resLoc = gl.getUniformLocation(program, 'u_resolution')
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse')
    const flareLoc = gl.getUniformLocation(program, 'u_flare')

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    // pointer follows the parent, eased so the disc glides instead of snapping
    const target = { x: 0.5, y: 0.5, flare: 0 }
    const current = { x: 0.5, y: 0.5, flare: 0 }
    const parent = canvas.parentElement ?? canvas
    const move = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect()
      target.x = (e.clientX - r.left) / Math.max(1, r.width)
      target.y = 1 - (e.clientY - r.top) / Math.max(1, r.height)
    }
    const down = () => { target.flare = 1 }
    const up = () => { target.flare = 0 }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)

    const start = Date.now()
    let raf = 0
    const render = () => {
      current.x += (target.x - current.x) * 0.04
      current.y += (target.y - current.y) * 0.04
      current.flare += (target.flare - current.flare) * 0.06
      gl.uniform1f(timeLoc, ((Date.now() - start) / 1000) * speed)
      gl.uniform2f(resLoc, canvas.width, canvas.height)
      gl.uniform2f(mouseLoc, current.x, current.y)
      gl.uniform1f(flareLoc, current.flare)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }
    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      cancelAnimationFrame(raf)
      gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteProgram(program); gl.deleteBuffer(buffer)
    }
  }, [speed])

  return <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 w-full h-full ${className ?? ''}`} style={{ opacity, pointerEvents: 'none' }} />
}

export default EtchedAccretion
