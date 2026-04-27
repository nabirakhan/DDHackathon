import { useEffect, useRef } from 'react'
import './SoftAurora.css'

interface SoftAuroraProps {
  speed?: number
  scale?: number
  brightness?: number
  color1?: string
  color2?: string
  noiseFrequency?: number
  noiseAmplitude?: number
  bandHeight?: number
  bandSpread?: number
  octaveDecay?: number
  layerOffset?: number
  colorSpeed?: number
  enableMouseInteraction?: boolean
  mouseInfluence?: number
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_speed;
uniform float u_scale;
uniform float u_brightness;
uniform float u_noiseFreq;
uniform float u_noiseAmp;
uniform float u_bandHeight;
uniform float u_bandSpread;
uniform float u_octaveDecay;
uniform float u_layerOffset;
uniform float u_colorSpeed;
uniform vec2 u_mouse;
uniform float u_mouseInfluence;

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= u_octaveDecay;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv.y = 1.0 - uv.y;

  float t = u_time * u_speed;
  float ct = u_time * u_colorSpeed;

  vec2 mouseInfluence = (u_mouse - uv) * u_mouseInfluence;
  vec2 warpedUv = uv + mouseInfluence * 0.05;

  float color = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec3 p = vec3(warpedUv * u_scale * u_noiseFreq, t + fi * u_layerOffset);
    float n = fbm(p) * u_noiseAmp;
    float band = smoothstep(u_bandHeight + u_bandSpread, u_bandHeight - u_bandSpread,
                            abs(warpedUv.y - 0.5 - n));
    color += band / 3.0;
  }

  color *= u_brightness;
  color = clamp(color, 0.0, 1.0);

  float blend = 0.5 + 0.5 * sin(ct);
  vec3 col = mix(u_color1, u_color2, blend) * color;

  float bg = 0.04;
  col = col + vec3(bg);

  gl_FragColor = vec4(col, 1.0);
}
`

export function SoftAurora({
  speed = 0.3,
  scale = 1.0,
  brightness = 0.7,
  color1 = '#5D5646',
  color2 = '#3E5974',
  noiseFrequency = 1.2,
  noiseAmplitude = 0.5,
  bandHeight = 0.5,
  bandSpread = 0.3,
  octaveDecay = 0.5,
  layerOffset = 1.3,
  colorSpeed = 0.15,
  enableMouseInteraction = true,
  mouseInfluence = 0.3,
}: SoftAuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    container.appendChild(canvas)

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      return s
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const u = (name: string) => gl.getUniformLocation(prog, name)
    const uTime = u('u_time')
    const uRes = u('u_resolution')
    const uC1 = u('u_color1')
    const uC2 = u('u_color2')
    const uSpeed = u('u_speed')
    const uScale = u('u_scale')
    const uBrightness = u('u_brightness')
    const uNoiseFreq = u('u_noiseFreq')
    const uNoiseAmp = u('u_noiseAmp')
    const uBandHeight = u('u_bandHeight')
    const uBandSpread = u('u_bandSpread')
    const uOctaveDecay = u('u_octaveDecay')
    const uLayerOffset = u('u_layerOffset')
    const uColorSpeed = u('u_colorSpeed')
    const uMouse = u('u_mouse')
    const uMouseInfluence = u('u_mouseInfluence')

    const c1 = hexToRgb(color1)
    const c2 = hexToRgb(color2)
    gl.uniform3fv(uC1, c1)
    gl.uniform3fv(uC2, c2)
    gl.uniform1f(uSpeed, speed)
    gl.uniform1f(uScale, scale)
    gl.uniform1f(uBrightness, brightness)
    gl.uniform1f(uNoiseFreq, noiseFrequency)
    gl.uniform1f(uNoiseAmp, noiseAmplitude)
    gl.uniform1f(uBandHeight, bandHeight)
    gl.uniform1f(uBandSpread, bandSpread)
    gl.uniform1f(uOctaveDecay, octaveDecay)
    gl.uniform1f(uLayerOffset, layerOffset)
    gl.uniform1f(uColorSpeed, colorSpeed)
    gl.uniform1f(uMouseInfluence, enableMouseInteraction ? mouseInfluence : 0)
    gl.uniform2f(uMouse, 0.5, 0.5)

    let mouse = { x: 0.5, y: 0.5 }
    const onMove = (e: MouseEvent) => {
      mouse = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
    }
    if (enableMouseInteraction) window.addEventListener('mousemove', onMove)

    function resize() {
      const w = container!.clientWidth
      const h = container!.clientHeight
      canvas.width = Math.floor(w * 0.5)
      canvas.height = Math.floor(h * 0.5)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      gl!.viewport(0, 0, canvas.width, canvas.height)
      gl!.uniform2f(uRes, canvas.width, canvas.height)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let raf = 0
    const start = performance.now()

    function frame() {
      gl!.uniform1f(uTime, (performance.now() - start) / 1000)
      gl!.uniform2f(uMouse, mouse.x, mouse.y)
      gl!.drawArrays(gl!.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (enableMouseInteraction) window.removeEventListener('mousemove', onMove)
      canvas.remove()
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [speed, scale, brightness, color1, color2, noiseFrequency, noiseAmplitude,
      bandHeight, bandSpread, octaveDecay, layerOffset, colorSpeed,
      enableMouseInteraction, mouseInfluence])

  return <div ref={containerRef} className="soft-aurora-container" />
}
