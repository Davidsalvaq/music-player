import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTheme } from '../context/ThemeContext'

// NDC vertex shader: position.xy IS already in clip space (-1..+1),
// so no MVP transform needed — the quad always covers the full screen.
const vertexShader = `
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform sampler2D grainTex;
uniform sampler2D blurTex;
uniform float     time;
uniform float     seed;
uniform vec3      back;
uniform vec3      front;
uniform float     style;
uniform float     param1;
uniform float     param2;
uniform float     param3;

varying vec2 vUv;

#define PI 3.141592653589793

vec3 mod289(vec3 x) { return x - floor(x*(1.0/289.0))*289.0; }
vec2 mod289(vec2 x) { return x - floor(x*(1.0/289.0))*289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+10.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0*fract(p*C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x *x0.x  + h.x *x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m,g);
}

float snoise01(vec2 v) { return (1.0 + snoise(v)) * 0.5; }

float noise2d(vec2 st) {
  return snoise01(vec2(st.x + time*0.02, st.y - time*0.04 + seed));
}

float pattern(vec2 p) {
  vec2 q = vec2(noise2d(p + vec2(0.0, 0.0)),
                noise2d(p + vec2(5.2, 1.3)));
  vec2 r = vec2(noise2d(p + 4.0*q + vec2(1.7, 9.2)),
                noise2d(p + 4.0*q + vec2(8.3, 2.8)));
  return noise2d(p + 1.0*r);
}

void main() {
  vec2 uv = vUv;
  vec2 p  = gl_FragCoord.xy;

  uv = style > 0.0 ? ceil(uv * 50.0) / 50.0 : uv;

  vec3  grainColor = texture2D(grainTex, mod(p*param1*5.0, 1024.0)/1024.0).rgb;
  float blurAlpha  = texture2D(blurTex, uv).a;

  float gr = pow(grainColor.r, 1.5) + 0.5*(1.0 - blurAlpha);
  float gg = grainColor.g;
  float ax = param2 * gr * cos(gg * 2.0*PI);
  float ay = param2 * gr * sin(gg * 2.0*PI);

  float ndx = param3       + 0.1*(1.0 - blurAlpha);
  float ndy = 2.0*param3   + 0.1*(1.0 - blurAlpha);
  float n = pattern(vec2(uv.x*ndx + ax, uv.y*ndy + ay));

  n = pow(n*1.05, 6.0);
  n = smoothstep(0.0, 1.0, n);

  vec3 result = mix(back, front, n);
  gl_FragColor = vec4(result, blurAlpha);
}
`

// ─── Grain texture ────────────────────────────────────────────────────────────
function createGrainTex() {
  const size = 1024
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    data[i*4]   = Math.random() * 255 | 0
    data[i*4+1] = Math.random() * 255 | 0
    data[i*4+2] = 0
    data[i*4+3] = 255
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

// ─── Blur texture: base fill + center + upper-right ───────────────────────────
function createBlurTex() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)

  // Base: particles visible across the ENTIRE screen
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillRect(0, 0, size, size)

  // Center concentration
  const ambient = ctx.createRadialGradient(
    size*0.50, size*0.48, 0,
    size*0.50, size*0.48, size*0.80
  )
  ambient.addColorStop(0.0,  'rgba(255,255,255,0.55)')
  ambient.addColorStop(0.40, 'rgba(255,255,255,0.40)')
  ambient.addColorStop(0.70, 'rgba(255,255,255,0.18)')
  ambient.addColorStop(1.0,  'rgba(255,255,255,0.00)')
  ctx.fillStyle = ambient
  ctx.fillRect(0, 0, size, size)

  // Upper-right boost
  const boost = ctx.createRadialGradient(
    size*0.70, size*0.22, 0,
    size*0.70, size*0.22, size*0.42
  )
  boost.addColorStop(0.0,  'rgba(255,255,255,0.28)')
  boost.addColorStop(0.55, 'rgba(255,255,255,0.12)')
  boost.addColorStop(1.0,  'rgba(255,255,255,0.00)')
  ctx.fillStyle = boost
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

// ─── Theme config ─────────────────────────────────────────────────────────────
const THEMES = {
  dark:  { back: [0.039, 0.039, 0.039], front: [0.82, 0.82, 0.82] },
  light: { back: [0.941, 0.941, 0.941], front: [0.14, 0.14, 0.14] },
  blue:  { back: [0.282, 0.004, 1.000], front: [0.04, 0.01, 0.14] },
}

// ─── Inner mesh ───────────────────────────────────────────────────────────────
function ParticlesMesh({ theme, monospaced }) {
  const matRef = useRef()

  const { grainTex, blurTex } = useMemo(() => ({
    grainTex: createGrainTex(),
    blurTex:  createBlurTex(),
  }), [])

  const uniforms = useRef({
    grainTex: { value: null },
    blurTex:  { value: null },
    time:     { value: 0 },
    seed:     { value: Math.random() * 10 },
    back:     { value: new THREE.Vector3(...THEMES.dark.back) },
    front:    { value: new THREE.Vector3(...THEMES.dark.front) },
    style:    { value: 0 },
    param1:   { value: 0.28 },
    param2:   { value: 0.18 },
    param3:   { value: 1.6 },
  })

  useEffect(() => {
    uniforms.current.grainTex.value = grainTex
    uniforms.current.blurTex.value  = blurTex
  }, [grainTex, blurTex])

  useEffect(() => {
    const t = THEMES[theme] ?? THEMES.dark
    uniforms.current.back.value.set(...t.back)
    uniforms.current.front.value.set(...t.front)
  }, [theme])

  useEffect(() => {
    uniforms.current.style.value = monospaced ? 1.0 : 0.0
  }, [monospaced])

  useFrame(({ clock }) => {
    uniforms.current.time.value = clock.getElapsedTime()
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <rawShaderMaterial
        ref={matRef}
        uniforms={uniforms.current}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function ParticleBackground({ monospaced = false }) {
  const { theme } = useTheme()
  const canvasRef = useRef(null)

  // Pause the render loop when the tab is not visible
  useEffect(() => {
    const handleVisibility = () => {
      if (!canvasRef.current) return
      // @react-three/fiber exposes gl.setFrameloop via the canvas ref internals
      // We toggle the canvas display as a lightweight proxy pause
      canvasRef.current.style.visibility = document.hidden ? 'hidden' : 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <Canvas
      ref={canvasRef}
      frameloop="always"
      camera={{ position: [0, 0, 1], fov: 90, near: 0.1, far: 10 }}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
      gl={{ alpha: true, antialias: false }}
      dpr={Math.min(window.devicePixelRatio, 1.5)}
    >
      <ParticlesMesh theme={theme} monospaced={monospaced} />
    </Canvas>
  )
}
