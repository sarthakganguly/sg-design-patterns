import { AlgorithmOutput } from '@sg-pattern-engine/core';

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Scalar field: greyscale with colorMode support
const FRAG_SCALAR = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform int u_colorMode; // 0=grayscale 1=hsl 2=hsv 3=gradient 4=palette
uniform vec3 u_palA;
uniform vec3 u_palB;
in vec2 v_uv;
out vec4 outColor;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0*l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
  float m = l - c*0.5;
  vec3 rgb;
  if      (h < 1.0/6.0) rgb = vec3(c,x,0);
  else if (h < 2.0/6.0) rgb = vec3(x,c,0);
  else if (h < 3.0/6.0) rgb = vec3(0,c,x);
  else if (h < 4.0/6.0) rgb = vec3(0,x,c);
  else if (h < 5.0/6.0) rgb = vec3(x,0,c);
  else                   rgb = vec3(c,0,x);
  return rgb + m;
}

vec3 hsv2rgb(float h, float s, float v) {
  float c = v * s;
  float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
  float m = v - c;
  vec3 rgb;
  if      (h < 1.0/6.0) rgb = vec3(c,x,0);
  else if (h < 2.0/6.0) rgb = vec3(x,c,0);
  else if (h < 3.0/6.0) rgb = vec3(0,c,x);
  else if (h < 4.0/6.0) rgb = vec3(0,x,c);
  else if (h < 5.0/6.0) rgb = vec3(x,0,c);
  else                   rgb = vec3(c,0,x);
  return rgb + m;
}

void main() {
  float v = texture(u_tex, v_uv).r;
  vec3 col;
  if (u_colorMode == 1) {
    col = hsl2rgb(v, 0.8, 0.5);
  } else if (u_colorMode == 2) {
    col = hsv2rgb(v, 0.9, v);
  } else if (u_colorMode == 3) {
    col = mix(u_palA, u_palB, v);
  } else {
    col = vec3(v);
  }
  outColor = vec4(col, 1.0);
}`;

// Vector field: hue encodes angle, lightness encodes magnitude
const FRAG_VECTOR = `#version 300 es
precision highp float;
uniform sampler2D u_tex; // RG = dx,dy packed into 0..1
in vec2 v_uv;
out vec4 outColor;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0*l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
  float m = l - c*0.5;
  vec3 rgb;
  if      (h < 1.0/6.0) rgb = vec3(c,x,0);
  else if (h < 2.0/6.0) rgb = vec3(x,c,0);
  else if (h < 3.0/6.0) rgb = vec3(0,c,x);
  else if (h < 4.0/6.0) rgb = vec3(0,x,c);
  else if (h < 5.0/6.0) rgb = vec3(x,0,c);
  else                   rgb = vec3(c,0,x);
  return rgb + m;
}

void main() {
  vec2 dxy = texture(u_tex, v_uv).rg * 2.0 - 1.0; // unpack 0..1 -> -1..1
  float angle = atan(dxy.y, dxy.x);               // -PI..PI
  float hue   = (angle / 6.28318) + 0.5;          // 0..1
  float mag   = clamp(length(dxy), 0.0, 1.0);
  outColor = vec4(hsl2rgb(hue, 0.85, 0.3 + mag * 0.5), 1.0);
}`;

type ColorMode = 'grayscale' | 'palette' | 'gradient' | 'hsv' | 'hsl';

function hexToVec3(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private scalarProgram: WebGLProgram;
  private vectorProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private texture: WebGLTexture;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.scalarProgram = this.buildProgram(VERT_SRC, FRAG_SCALAR);
    this.vectorProgram = this.buildProgram(VERT_SRC, FRAG_VECTOR);
    this.vao = this.buildQuad();
    this.texture = gl.createTexture()!;
  }

  public render(
    output: AlgorithmOutput,
    colorMode: ColorMode = 'grayscale',
    palette: string[] = []
  ): void {
    const gl = this.gl;

    if (output.type === 'scalarField') {
      this.uploadScalar(output.data, output.width, output.height);
      gl.useProgram(this.scalarProgram);
      this.setScalarUniforms(colorMode, palette);
      this.draw();

    } else if (output.type === 'vectorField') {
      this.uploadVector(output.data, output.width, output.height);
      gl.useProgram(this.vectorProgram);
      gl.uniform1i(gl.getUniformLocation(this.vectorProgram, 'u_tex'), 0);
      this.draw();
    }
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private uploadScalar(data: Float32Array, w: number, h: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private uploadVector(data: Float32Array, w: number, h: number): void {
    const gl = this.gl;
    // Pack interleaved [dx,dy,...] Float32 into RG8 by normalising -1..1 -> 0..255
    const packed = new Uint8Array(w * h * 2);
    for (let i = 0; i < w * h; i++) {
      packed[i * 2]     = Math.round((data[i * 2]     * 0.5 + 0.5) * 255);
      packed[i * 2 + 1] = Math.round((data[i * 2 + 1] * 0.5 + 0.5) * 255);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, w, h, 0, gl.RG, gl.UNSIGNED_BYTE, packed);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private setScalarUniforms(colorMode: ColorMode, palette: string[]): void {
    const gl = this.gl;
    const p = this.scalarProgram;
    const modeIndex = { grayscale: 0, hsl: 1, hsv: 2, gradient: 3, palette: 4 }[colorMode] ?? 0;
    gl.uniform1i(gl.getUniformLocation(p, 'u_colorMode'), modeIndex);
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);

    // For gradient mode use first two palette entries (or sensible defaults)
    const colA = palette[0] ? hexToVec3(palette[0]) : [0, 0, 0.2] as [number,number,number];
    const colB = palette[1] ? hexToVec3(palette[1]) : [1, 0.8, 0.2] as [number,number,number];
    gl.uniform3fv(gl.getUniformLocation(p, 'u_palA'), colA);
    gl.uniform3fv(gl.getUniformLocation(p, 'u_palB'), colB);
  }

  private draw(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private buildQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // Full-screen quad in clip space
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,  1, 1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private buildProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vert);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  public dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.scalarProgram);
    gl.deleteProgram(this.vectorProgram);
  }
}