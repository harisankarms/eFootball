/**
 * The animated background of eFootball 2026 Epic cards: a flight through honeycombs of
 * hexagonal tubes lined with neon frames. Each pixel's ray is traced through the scene in a
 * WebGL fragment shader, so no 3D library is needed.
 *
 * The scene is a row of honeycomb slabs with open space between them. Leaving a tube, the
 * camera sees the face of the next slab (usually a junction of three tubes straight ahead),
 * swerves into one of its tubes, and so on, rolling slowly the whole time.
 */

export type Rgb = readonly [number, number, number]
export type TunnelColors = { neon: Rgb; hot: Rgb; steel: Rgb; rim: Rgb }

export const EPIC_TUNNEL: TunnelColors = {
  neon: [0.07, 1, 0.16],
  hot: [1, 0.72, 0.2],
  steel: [0.035, 0.08, 0.125],
  rim: [0.22, 0.42, 0.66],
}

export const EMPTY_TUNNEL: TunnelColors = {
  neon: [0.42, 0.56, 0.9],
  hot: [0.8, 0.86, 1],
  steel: [0.06, 0.08, 0.13],
  rim: [0.42, 0.5, 0.66],
}

/** Good-looking moments to start the animation on, and to use for still images. */
export const TUNNEL_START = 0.8
const STILL_AT = 1.2

const TUBE = 3.6
const OPEN = 4.2
const SECTION = TUBE + OPEN
const SPEED = 2.5
const SURGE = 0.6
const SLOWEST = 0.6
const FOV = 1.5

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform vec2 uOrigin[4];
uniform vec2 uSpin[4];
uniform vec2 uCam;
uniform mat3 uBasis;
uniform vec2 uVanish;
uniform float uDepth;
uniform vec3 uNeon;
uniform vec3 uHot;
uniform vec3 uSteel;
uniform vec3 uRim;

const float TUBE = ${TUBE.toFixed(2)};
const float SECTION = ${SECTION.toFixed(2)};
const float FOV = ${FOV.toFixed(2)};
const float APO = 0.8660254;
const float WALL = 0.2;
const float INNER = 0.6660254;
const float SPACING = 0.75;
const float FIRST = 0.45;
const float FRAMES = 5.0;
const float BAND = 0.1;

vec2 cellCentre(vec2 p) {
  vec2 s = vec2(1.7320508, 3.0);
  vec2 a = floor(p / s + 0.5) * s;
  vec2 b = floor((p - 0.5 * s) / s + 0.5) * s + 0.5 * s;
  return dot(p - a, p - a) < dot(p - b, p - b) ? a : b;
}

float hexRadius(vec2 h) {
  h = abs(h);
  return max(h.x, 0.5 * h.x + 0.8660254 * h.y);
}

float exitAlong(vec2 n, vec2 h, vec2 d, float best, inout vec2 hitN) {
  float k = dot(n, d);
  float side = k < 0.0 ? -1.0 : 1.0;
  float t = (INNER - side * dot(n, h)) / max(abs(k), 1e-5);
  if (t < best) {
    hitN = n * side;
    return t;
  }
  return best;
}

vec3 tubeWall(float z, float dist, vec2 h, vec2 n, float px) {
  float f = (z - FIRST) / SPACING;
  float i = floor(f + 0.5);
  float on = step(0.0, i) * step(i, FRAMES - 1.0);
  float d = abs(f - i) * SPACING;
  float aa = dist * px;
  float w = max(BAND, aa * 1.2);
  float energy = BAND / w;
  float body = exp(-pow(d / w, 2.0) * 2.2);
  float core = exp(-pow(d / (w * 0.35 + aa * 0.5), 2.0));
  float halo = exp(-d * 3.5) * on;
  float along = abs(dot(vec2(-n.y, n.x), h)) / (INNER * 0.5773503);
  float corner = smoothstep(0.6, 1.0, along);
  vec3 c = uSteel * (0.4 + 0.5 * halo) * (1.0 - 0.6 * corner);
  c += uNeon * halo * 0.3 * (1.0 - 0.4 * corner);
  c += uNeon * body * 1.25 * on * energy * (1.0 - 0.3 * corner);
  c += mix(uNeon, vec3(1.0), 0.55) * core * 0.7 * on * energy;
  return c;
}

vec3 distant(vec3 c, float dist) {
  return mix(c, uNeon * 0.06, smoothstep(SECTION * 1.1, SECTION * 2.6, dist));
}

vec3 girder(vec2 h, float e, vec2 spin, float px) {
  vec2 a = abs(h);
  vec2 n = a.x > 0.5 * a.x + 0.8660254 * a.y ? vec2(1.0, 0.0) : vec2(0.5, 0.8660254);
  n *= vec2(h.x < 0.0 ? -1.0 : 1.0, h.y < 0.0 ? -1.0 : 1.0);
  vec2 nw = vec2(spin.x * n.x - spin.y * n.y, spin.y * n.x + spin.x * n.y);
  float light = dot(nw, vec2(-0.45, 0.89));
  float rim = smoothstep(WALL * 0.55, WALL - px, e);
  float seam = 1.0 - smoothstep(0.0, 0.015 + px, e);
  vec3 c = uSteel * (0.9 + 0.5 * light);
  c += uRim * rim * (0.55 + 0.45 * light);
  c += uNeon * (0.04 + 0.12 * smoothstep(WALL * 0.3, WALL, e));
  return c * (1.0 - 0.5 * seam);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ray = uBasis * vec3(p * FOV, 1.0);
  float r = length(p - uVanish);
  if (ray.z < 0.05) {
    gl_FragColor = vec4(uSteel * 0.3, 1.0);
    return;
  }
  vec2 dir = ray.xy / ray.z;
  float px = FOV / uRes.y / ray.z;
  vec2 pos = uCam;
  float z = uDepth;
  float dist = 0.0;
  float hitDist = 1e4;
  vec3 col = vec3(0.0);
  bool hit = false;
  vec3 front = vec3(0.0);
  float frontCover = 0.0;
  float frontDist = 0.0;
  for (int k = 0; k < 4; k++) {
    if (z < TUBE) {
      vec2 sp = uSpin[k];
      vec2 rel = pos - uOrigin[k];
      vec2 lp = vec2(sp.x * rel.x + sp.y * rel.y, -sp.y * rel.x + sp.x * rel.y);
      vec2 ld = vec2(sp.x * dir.x + sp.y * dir.y, -sp.y * dir.x + sp.x * dir.y);
      vec2 h = lp - cellCentre(lp);
      if (k > 0) {
        float e = APO - hexRadius(h);
        float aa = dist * px;
        if (e < WALL + aa) {
          float cover = 1.0 - smoothstep(WALL - aa, WALL + aa, e);
          vec3 g = girder(h, e, sp, aa);
          if (cover > 0.99) {
            col = g;
            hitDist = dist;
            hit = true;
            break;
          }
          if (frontCover == 0.0) {
            front = g;
            frontCover = cover;
            frontDist = dist;
          }
        }
      }
      vec2 n = vec2(1.0, 0.0);
      float t = 1e5;
      t = exitAlong(vec2(1.0, 0.0), h, ld, t, n);
      t = exitAlong(vec2(0.5, 0.8660254), h, ld, t, n);
      t = exitAlong(vec2(-0.5, 0.8660254), h, ld, t, n);
      t = max(t, 0.0);
      float left = TUBE - z;
      if (t < left) {
        col = tubeWall(z + t, dist + t, h + ld * t, n, px);
        hitDist = dist + t;
        hit = true;
        break;
      }
      pos += dir * left;
      dist += left;
      z = TUBE;
    }
    float open = SECTION - z;
    pos += dir * open;
    dist += open;
    z = 0.0;
  }
  col = distant(col, hit ? hitDist : 1e4);
  float far = smoothstep(SECTION * 0.6, SECTION * 1.5, hitDist);
  vec3 glow = mix(uHot, vec3(1.0, 0.95, 0.75), exp(-r * 40.0)) * 1.4;
  col = mix(col, glow, far * (1.0 - smoothstep(0.0, 0.2, r)));
  col += uHot * exp(-r * 25.0) * 1.2 * far;
  col = mix(col, distant(front, frontDist), frontCover);
  col = 1.0 - exp(-col * 1.4);
  gl_FragColor = vec4(col, 1.0);
}
`

function hash(n: number, salt: number) {
  const k = ((n % 997) + 997) % 997
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function ease(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * How the slab after `section` lies: turned by `angle`, and shifted by `step` from the tube the
 * camera came through. Usually a junction of three tubes sits straight ahead; sometimes a tube.
 */
function boundary(section: number) {
  const heading = hash(section, 1) * Math.PI * 2
  const straight = hash(section, 2) < 0.3
  return {
    angle: heading + Math.PI / 2,
    step: straight ? [0, 0] : [Math.cos(heading), Math.sin(heading)],
  }
}

function normalize(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Where the camera is, where it looks and how the slabs lie, at a moment in time. */
function cameraAt(seconds: number) {
  // Fast through the tubes, slowest a little before each honeycomb face.
  const sections = (seconds * SPEED) / SECTION
  const first = Math.floor(sections)
  const u = sections - first
  const wave = Math.sin(2 * Math.PI * (u - SLOWEST)) + Math.sin(2 * Math.PI * SLOWEST)
  const depth = SECTION * (u - (SURGE * wave) / (2 * Math.PI))

  // Slab origins relative to the tube the camera is in (or has just left).
  const origin = new Float32Array(12)
  const spin = new Float32Array(12)
  let angle = boundary(first - 1).angle
  for (let k = 0; k < 6; k++) {
    if (k > 0) {
      const b = boundary(first + k - 1)
      origin[k * 2] = origin[k * 2 - 2] + b.step[0]
      origin[k * 2 + 1] = origin[k * 2 - 1] + b.step[1]
      angle = b.angle
    }
    if (k < 6) {
      spin[k * 2] = Math.cos(angle)
      spin[k * 2 + 1] = Math.sin(angle)
    }
  }

  // The camera runs down the middle of each tube and changes tubes in the open space.
  const camAt = (z: number) => {
    const k = Math.floor(z / SECTION)
    const inside = z - k * SECTION
    const move = inside < TUBE ? 0 : ease(0, 0.85, (inside - TUBE) / OPEN)
    return [
      origin[k * 2] + (origin[k * 2 + 2] - origin[k * 2]) * move,
      origin[k * 2 + 1] + (origin[k * 2 + 3] - origin[k * 2 + 1]) * move,
    ]
  }
  const cam = camAt(depth)
  const ahead = camAt(depth + 1.6)

  // Look where the path goes, while also gazing around a little.
  const forward = normalize([
    (ahead[0] - cam[0]) / 1.6 + 0.2 * Math.sin(seconds * 0.41),
    (ahead[1] - cam[1]) / 1.6 + 0.16 * Math.sin(seconds * 0.29 + 1.3),
    1,
  ])
  const flatRight = normalize([forward[2], 0, -forward[0]])
  const flatUp = [
    forward[1] * flatRight[2] - forward[2] * flatRight[1],
    forward[2] * flatRight[0] - forward[0] * flatRight[2],
    forward[0] * flatRight[1] - forward[1] * flatRight[0],
  ]
  const roll = seconds * 0.3 + 0.35 * Math.sin(seconds * 0.45)
  const rc = Math.cos(roll)
  const rs = Math.sin(roll)
  const right = flatRight.map((v, i) => v * rc + flatUp[i] * rs)
  const up = flatUp.map((v, i) => v * rc - flatRight[i] * rs)

  return {
    cam,
    basis: new Float32Array([...right, ...up, ...forward]),
    vanish: [right[2] / forward[2] / FOV, up[2] / forward[2] / FOV],
    depth,
    origin: origin.subarray(0, 8),
    spin: spin.subarray(0, 8),
  }
}

export type Tunnel = {
  /** Draws the frame for this moment, in seconds. */
  draw(seconds: number): void
  /** Sets the drawing size in device pixels. */
  resize(width: number, height: number): void
  destroy(): void
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Epic card background:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Sets up the background on a canvas; returns null when WebGL is not available. */
export function createTunnel(canvas: HTMLCanvasElement, colors: TunnelColors, attributes: WebGLContextAttributes = {}): Tunnel | null {
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', ...attributes })
  } catch {
    gl = null
  }
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Epic card background:', gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const at = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    res: at('uRes'),
    origin: at('uOrigin'),
    spin: at('uSpin'),
    cam: at('uCam'),
    basis: at('uBasis'),
    vanish: at('uVanish'),
    depth: at('uDepth'),
  }
  gl.uniform3fv(at('uNeon'), colors.neon)
  gl.uniform3fv(at('uHot'), colors.hot)
  gl.uniform3fv(at('uSteel'), colors.steel)
  gl.uniform3fv(at('uRim'), colors.rim)

  return {
    draw(seconds) {
      if (gl.isContextLost()) return
      const c = cameraAt(seconds)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform2fv(u.origin, c.origin)
      gl.uniform2fv(u.spin, c.spin)
      gl.uniform2fv(u.cam, c.cam)
      gl.uniformMatrix3fv(u.basis, false, c.basis)
      gl.uniform2fv(u.vanish, c.vanish)
      gl.uniform1f(u.depth, c.depth)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
    },
    destroy() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

const stills = new Map<TunnelColors, Promise<string | null>>()
const readyStills = new Map<TunnelColors, string | null>()

/** The still image if it has already been made, so cards can show it on their first render. */
export function readyTunnelStill(colors: TunnelColors) {
  return readyStills.get(colors)
}

/** One frame of the background as an image, for the small collection cards (one WebGL context for all of them). */
export function tunnelStill(colors: TunnelColors, width: number, height: number): Promise<string | null> {
  let still = stills.get(colors)
  if (!still) {
    still = new Promise((resolve) => {
      setTimeout(() => {
        const canvas = document.createElement('canvas')
        const tunnel = createTunnel(canvas, colors, { preserveDrawingBuffer: true })
        let url: string | null = null
        if (tunnel) {
          tunnel.resize(width, height)
          tunnel.draw(STILL_AT)
          try {
            url = canvas.toDataURL('image/jpeg', 0.9)
          } catch {
            url = null
          }
          tunnel.destroy()
        }
        readyStills.set(colors, url)
        resolve(url)
      }, 0)
    })
    stills.set(colors, still)
  }
  return still
}
