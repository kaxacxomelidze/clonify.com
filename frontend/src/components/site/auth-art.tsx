import { useEffect, useId, useRef } from "react";

type Vector = [number, number, number];
type LogoFrame = { x: number; y: number; z: number };
type Face = { indices: [number, number, number, number]; normal: Vector; bevel: boolean };
const LOGO_SCALE = 5.9;
const CORNER_SEGMENTS = 16;
const HALF_WIDTH = 1.3;
const HALF_DEPTH = 2.8;
const BEVEL = 0.4;
// Keep the BrandMark's 24-unit squares, 6-unit corners and 10-unit offset.
// Separate the extrusions so their solid bodies cannot intersect as they turn.
const LOGO_FRAMES: LogoFrame[] = [
  { x: 3, y: 3, z: -3.2 },
  { x: 13, y: 13, z: 3.2 },
];

// A closed, chamfered rectangular cross-section: front, back, inner/outer walls
// and four narrow bevels. Shared vertices keep every adjoining surface sealed.
const PROFILE: [number, number][] = [
  [HALF_WIDTH - BEVEL, -HALF_DEPTH],
  [HALF_WIDTH, -HALF_DEPTH + BEVEL],
  [HALF_WIDTH, HALF_DEPTH - BEVEL],
  [HALF_WIDTH - BEVEL, HALF_DEPTH],
  [-HALF_WIDTH + BEVEL, HALF_DEPTH],
  [-HALF_WIDTH, HALF_DEPTH - BEVEL],
  [-HALF_WIDTH, -HALF_DEPTH + BEVEL],
  [-HALF_WIDTH + BEVEL, -HALF_DEPTH],
];
const PERIMETER_SAMPLES = 4 * (CORNER_SEGMENTS + 1);
const MATERIALS = Array.from({ length: 25 }, (_, index) => ({ light: 0.34 + (index / 24) * 0.66 }));
const MESH = (() => {
  const vertices: Vector[] = [];
  const radials: Vector[] = [];
  const faces: Face[] = [];
  for (const logoFrame of LOGO_FRAMES) {
    const start = vertices.length;
    for (let corner = 0; corner < 4; corner++) {
      const rotation = (corner * Math.PI) / 2;
      const cr = Math.cos(rotation),
        sr = Math.sin(rotation);
      for (let step = 0; step <= CORNER_SEGMENTS; step++) {
        const angle = -Math.PI / 2 + (step / CORNER_SEGMENTS) * (Math.PI / 2);
        for (const [width, depth] of PROFILE) {
          const x = 6 + (6 + width) * Math.cos(angle);
          const y = -6 + (6 + width) * Math.sin(angle);
          vertices.push([
            (logoFrame.x - 8 + x * cr - y * sr) * LOGO_SCALE,
            (logoFrame.y - 8 + x * sr + y * cr) * LOGO_SCALE,
            (logoFrame.z + depth) * LOGO_SCALE,
          ]);
          radials.push([Math.cos(angle + rotation), Math.sin(angle + rotation), 0]);
        }
      }
    }
    const vertex = (perimeter: number, profile: number) =>
      start + (perimeter % PERIMETER_SAMPLES) * PROFILE.length + (profile % PROFILE.length);
    for (let perimeter = 0; perimeter < PERIMETER_SAMPLES; perimeter++) {
      for (let profile = 0; profile < PROFILE.length; profile++) {
        const indices: Face["indices"] = [
          vertex(perimeter, profile),
          vertex(perimeter + 1, profile),
          vertex(perimeter + 1, profile + 1),
          vertex(perimeter, profile + 1),
        ];
        const a = vertices[indices[0]]!,
          b = vertices[indices[1]]!,
          d = vertices[indices[3]]!;
        const u: Vector = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v: Vector = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const normal: Vector = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const length = Math.hypot(...normal);
        faces.push({
          indices,
          normal: normal.map((value) => value / length) as Vector,
          bevel: profile % 2 === 0,
        });
      }
    }
  }
  return { vertices, radials, faces };
})();

function frame(time: number) {
  const ry = 0.4 + time * 0.16;
  const rx = -0.42 + Math.sin(time * 0.24) * 0.24;
  const rz = -0.38 + Math.sin(time * 0.16) * 0.18;
  const cy = Math.cos(ry),
    sy = Math.sin(ry),
    cx = Math.cos(rx),
    sx = Math.sin(rx),
    cz = Math.cos(rz),
    sz = Math.sin(rz);
  const rotate = ([x, y, z]: Vector): Vector => {
    const x1 = x * cy + z * sy,
      z1 = -x * sy + z * cy;
    const y2 = y * cx - z1 * sx,
      z2 = y * sx + z1 * cx;
    return [x1 * cz - y2 * sz, x1 * sz + y2 * cz, z2];
  };
  const bob = Math.sin(time * 0.8) * 7;
  const vertices = MESH.vertices.map(rotate);
  const projected = vertices.map(([x, y, z]) => {
    const perspective = 620 / (620 - z);
    return `${(320 + x * perspective * 1.4).toFixed(2)},${(231 + y * perspective * 1.4 + bob).toFixed(2)}`;
  });
  return MESH.faces
    .map(({ indices, normal, bevel }) => {
      const [nx, ny, nz] = rotate(normal);
      const [x, y, z] = vertices[indices[0]]!;
      // Cull only faces pointing away from the perspective camera. In particular,
      // inner and outer side walls remain visible when the front turns edge-on.
      const visible = nx * -x + ny * -y + nz * (620 - z) > 0;
      const light = Math.max(0, -nx * 0.45 - ny * 0.6 + nz * 0.66);
      const shine = Math.pow(Math.max(0, -nx * 0.24 - ny * 0.32 + nz * 0.916), 20);
      const brightness = Math.min(1, 0.4 + light * 0.46 + shine * 0.18 + (bevel ? 0.12 : 0));
      return {
        d: visible
          ? indices.map((index, i) => `${i ? "L" : "M"}${projected[index]}`).join("") + "Z"
          : "",
        material: Math.round(((brightness - 0.34) / 0.66) * (MATERIALS.length - 1)),
        depth: indices.reduce((sum, index) => sum + vertices[index]![2], 0) / indices.length,
      };
    })
    .sort((a, b) => a.depth - b.depth);
}

const INITIAL_FRAME = frame(0);

// Smooth normals around the logo's corners, with hard normals across each bevel.
// The depth buffer handles overlapping front, back and side surfaces at any angle.
function createMetalRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const vertexSource = `
    attribute vec3 position;
    attribute vec3 normal;
    uniform float time;
    varying vec3 worldPosition;
    varying vec3 worldNormal;
    vec3 rotate(vec3 p) {
      float ry = 0.4 + time * 0.16;
      float rx = -0.42 + sin(time * 0.24) * 0.24;
      float rz = -0.38 + sin(time * 0.16) * 0.18;
      p = vec3(p.x * cos(ry) + p.z * sin(ry), p.y, -p.x * sin(ry) + p.z * cos(ry));
      p = vec3(p.x, p.y * cos(rx) - p.z * sin(rx), p.y * sin(rx) + p.z * cos(rx));
      return vec3(p.x * cos(rz) - p.y * sin(rz), p.x * sin(rz) + p.y * cos(rz), p.z);
    }
    void main() {
      worldPosition = rotate(position);
      worldNormal = rotate(normal);
      float w = 620.0 - worldPosition.z;
      float bob = sin(time * 0.8) * 7.0;
      gl_Position = vec4(
        worldPosition.x * 1.4 * 620.0 / 320.0,
        (9.0 - bob) * w / 240.0 - worldPosition.y * 1.4 * 620.0 / 240.0,
        1.002002 * w - 2.002002, w
      );
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 worldPosition;
    varying vec3 worldNormal;
    void main() {
      vec3 n = normalize(worldNormal);
      vec3 view = normalize(vec3(0.0, 0.0, 620.0) - worldPosition);
      vec3 r = reflect(-view, n);
      // Broad studio lights and a slim reflection strip give the silver body
      // continuous highlights, including the inner and outer side walls.
      vec3 metal = mix(vec3(0.025, 0.032, 0.04), vec3(0.29, 0.32, 0.35), smoothstep(-0.5, 0.9, -r.y));
      float key = pow(max(0.0, dot(r, normalize(vec3(-0.4, -0.55, 0.73)))), 16.0);
      float softbox = smoothstep(0.55, 0.9, dot(r, normalize(vec3(-0.9, -0.2, 0.6))));
      float strip = smoothstep(0.48, 0.58, r.x) * (1.0 - smoothstep(0.7, 0.8, r.x));
      float horizon = exp(-pow((r.y - 0.22) * 9.0, 2.0));
      metal += vec3(1.5, 1.48, 1.44) * key;
      metal += vec3(0.64, 0.68, 0.72) * softbox;
      metal += vec3(1.0, 1.03, 1.06) * strip;
      metal += vec3(0.55, 0.58, 0.62) * horizon * (0.4 + 0.6 * max(r.z, 0.0));
      float sweep = dot(worldPosition.xy, vec2(0.5, 0.866)) / 200.0 + r.x * 0.25 - r.y * 0.15;
      metal *= 1.0 - 0.65 * exp(-pow((sweep - 0.12) * 7.0, 2.0));
      metal += vec3(0.86, 0.88, 0.9) * exp(-pow((sweep + 0.35) * 4.0, 2.0));
      metal += vec3(0.09) * pow(1.0 - max(dot(n, view), 0.0), 3.0);
      metal = metal / (vec3(1.0) + metal * 0.55);
      gl_FragColor = vec4(pow(metal, vec3(0.4545)), 1.0);
    }
  `;
  const shaders: WebGLShader[] = [];
  const shader = (type: number, source: string) => {
    const result = gl.createShader(type);
    if (!result) return null;
    shaders.push(result);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    return gl.getShaderParameter(result, gl.COMPILE_STATUS) ? result : null;
  };
  const vertex = shader(gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const dispose = () => {
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
  };
  if (!vertex || !fragment || !program || !buffer) {
    dispose();
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return null;
  }
  const data: number[] = [];
  for (const { indices } of MESH.faces) {
    const profile = indices[0] % PROFILE.length;
    const [width, depth] = PROFILE[profile]!;
    const [nextWidth, nextDepth] = PROFILE[(profile + 1) % PROFILE.length]!;
    const radial = nextDepth - depth;
    const z = width - nextWidth;
    const length = Math.hypot(radial, z);
    for (const index of [indices[0], indices[1], indices[2], indices[0], indices[2], indices[3]]) {
      const [nx, ny] = MESH.radials[index]!;
      data.push(
        ...MESH.vertices[index]!,
        (nx * radial) / length,
        (ny * radial) / length,
        z / length,
      );
    }
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  for (const [name, offset] of [
    ["position", 0],
    ["normal", 12],
  ] as const) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, offset);
  }
  const timeUniform = gl.getUniformLocation(program, "time");
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  return {
    draw(time: number) {
      if (gl.isContextLost()) return false;
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(timeUniform, time);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 6);
      return true;
    },
    dispose,
  };
}

/** A solid, beveled chrome Clonyfy mark with continuous 3D rotation. */
export function AuthArt() {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const canvas = element.querySelector("canvas")!;
    const sculpture = element.querySelector<SVGGElement>(".auth-sculpture")!;
    const renderer = createMetalRenderer(canvas);
    const faces = element.querySelectorAll<SVGPathElement>(".auth-sculpture-contour");
    const particles = element.querySelectorAll<SVGCircleElement>(".auth-orbit-particle");
    const chrome = element.querySelector(".auth-chrome-gradient");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let request = 0;
    let previous = 0;
    let time = 0;
    const render = () => {
      const rendered = renderer?.draw(time) ?? false;
      canvas.style.opacity = rendered ? "1" : "0";
      sculpture.style.visibility = rendered ? "hidden" : "visible";
      if (rendered) return;
      frame(time).forEach((face, i) => {
        const path = faces[i];
        if (!path) return;
        path.setAttribute("d", face.d);
        path.setAttribute("fill", `url(#${id}-metal-${face.material})`);
        path.setAttribute("stroke", `url(#${id}-metal-${face.material})`);
      });
    };
    const draw = (now: number) => {
      request = requestAnimationFrame(draw);
      const elapsed = now - previous;
      const interval = 1000 / 30;
      if (elapsed < interval) return;
      time += previous ? Math.min(elapsed - (elapsed % interval), 70) / 1000 : 0;
      previous = now - (elapsed % interval);
      render();
      chrome?.setAttribute(
        "gradientTransform",
        `rotate(${(Math.sin(time * 0.32) * 18).toFixed(2)} 320 231)`,
      );
      particles.forEach((particle, i) => {
        const angle = time * (i ? -0.31 : 0.24) + i * 2.4;
        particle.setAttribute("cx", (320 + Math.cos(angle) * (i ? 257 : 275)).toFixed(2));
        particle.setAttribute("cy", (247 + Math.sin(angle) * (i ? 110 : 151)).toFixed(2));
      });
    };
    const sync = () => {
      cancelAnimationFrame(request);
      previous = 0;
      if (visible && !document.hidden && !media.matches) request = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    });
    observer.observe(element);
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(element);
    render();
    canvas.addEventListener("webglcontextlost", render);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", render);
      renderer?.dispose();
      canvas.style.opacity = "0";
      sculpture.style.visibility = "visible";
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [id]);
  return (
    <div ref={ref} className="auth-art" aria-hidden="true">
      <svg viewBox="0 0 640 480" fill="none" focusable="false">
        <defs>
          {MATERIALS.map(({ light }, index) => (
            <linearGradient key={index} id={`${id}-metal-${index}`} href={`#${id}-chrome`}>
              {[
                { offset: 0, value: 240 },
                { offset: 0.22, value: 160 },
                { offset: 0.4, value: 252 },
                { offset: 0.52, value: 75 },
                { offset: 0.72, value: 233 },
                { offset: 1, value: 115 },
              ].map(({ offset, value }) => {
                const shade = Math.round(value * light);
                return (
                  <stop
                    key={offset}
                    offset={offset}
                    stopColor={`rgb(${shade},${shade + 2},${shade + 3})`}
                  />
                );
              })}
            </linearGradient>
          ))}
          <linearGradient
            id={`${id}-chrome`}
            className="auth-chrome-gradient"
            x1="140"
            y1="60"
            x2="470"
            y2="390"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fcfeff" />
            <stop offset=".2" stopColor="#9ca9b4" />
            <stop offset=".38" stopColor="#eff5fa" />
            <stop offset=".52" stopColor="#404952" />
            <stop offset=".7" stopColor="#dbe8f2" />
            <stop offset="1" stopColor="#596674" />
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor="#b8c8d8" stopOpacity=".16" />
            <stop offset=".5" stopColor="#a2b7d0" stopOpacity=".035" />
            <stop offset="1" stopColor="#a2b7d0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-floor`}>
            <stop stopColor="#bacadc" stopOpacity=".15" />
            <stop offset="1" stopColor="#bacadc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="320" cy="231" rx="300" ry="220" fill={`url(#${id}-halo)`} />
        <g stroke="#bed0df" strokeWidth=".6">
          <ellipse
            cx="320"
            cy="247"
            rx="275"
            ry="151"
            transform="rotate(-22 320 247)"
            opacity=".18"
          />
          <ellipse
            cx="320"
            cy="247"
            rx="257"
            ry="110"
            transform="rotate(22 320 247)"
            strokeDasharray="1 7"
            opacity=".2"
          />
        </g>
        <ellipse cx="320" cy="424" rx="180" ry="22" fill={`url(#${id}-floor)`} />
        <g className="auth-sculpture" strokeWidth=".45" strokeLinejoin="round">
          {INITIAL_FRAME.map((face, i) => (
            <path
              key={i}
              className="auth-sculpture-contour"
              d={face.d}
              fill={`url(#${id}-metal-${face.material})`}
              stroke={`url(#${id}-metal-${face.material})`}
            />
          ))}
        </g>
        <g transform="rotate(-22 320 247)">
          <circle className="auth-orbit-particle" cx="595" cy="247" r="2.3" fill="#e4eef7" />
        </g>
        <g transform="rotate(22 320 247)">
          <circle className="auth-orbit-particle" cx="130.49" cy="321.3" r="1.6" fill="#b9c9d8" />
        </g>
        <g fill="#d6e2ed">
          <circle cx="153" cy="99" r="1" opacity=".6" />
          <circle cx="502" cy="361" r="1" opacity=".5" />
          <circle cx="533" cy="121" r="1.2" opacity=".7" />
        </g>
      </svg>
      <canvas
        width="640"
        height="480"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0 }}
      />
    </div>
  );
}
