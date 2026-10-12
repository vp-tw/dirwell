export function createWave(canvas, colors, root, moving, onReady) {
  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }
  if (!gl) return null;
  const vertex = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const fragment = `precision highp float;uniform vec2 resolution;uniform float time;uniform vec3 tint;
    void main(){vec2 uv=gl_FragCoord.xy/resolution;float x=uv.x;float y=uv.y;float t=time;
    vec3 ground=mix(tint*.22,tint,clamp(y*.85+x*.1,0.,1.));ground+=vec3(.035)*pow(max(0.,1.-distance(uv,vec2(.2,.9))),3.);
    float light=0.;for(int i=0;i<3;i++){float k=float(i);float center=.40+.07*sin(x*4.2+t*.17+k*.8)+.035*cos(x*7.1-t*.11+k*1.4)+k*.024;
    float breadth=.012+.037*(.5+.5*sin(x*2.7+t*.09+k));float d=y-center;float sheet=exp(-pow(d/breadth,2.));float edge=exp(-abs(d-breadth*.65)*430.);
    float fold=exp(-abs(d+breadth*.35)*170.);float taper=pow(sin(clamp(x,0.,1.)*3.14159),.6);light+=(sheet*.07+edge*.23+fold*.09)*taper;}
    ground+=mix(vec3(.6,.8,1.),vec3(1.),.75)*min(light,.12);gl_FragColor=vec4(ground,1.);}`;
  const shader = (type, source) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, vertex),
    fs = shader(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const p = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
  const r = gl.getUniformLocation(program, "resolution"),
    t = gl.getUniformLocation(program, "time"),
    c = gl.getUniformLocation(program, "tint");
  let frame = 0,
    last = 0,
    lost = false,
    frozenTime = 17;
  const draw = (now) => {
    if (lost) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / innerWidth, 1000 / innerHeight),
      width = Math.round(innerWidth * ratio),
      height = Math.round(innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    if (moving()) frozenTime = (Date.now() % 86400000) / 1000;
    gl.uniform2f(r, width, height);
    gl.uniform1f(t, frozenTime);
    gl.uniform3fv(c, colors[root.dataset.cwColor] ?? colors.azure);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    onReady(true);
    last = now;
  };
  const tick = (now) => {
    frame = 0;
    if (!moving() || lost) return;
    if (now - last >= 33) draw(now);
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const sync = () => {
    stop();
    if (lost) return;
    draw(0);
    if (moving()) frame = requestAnimationFrame(tick);
  };
  const contextLost = (event) => {
    event.preventDefault();
    lost = true;
    stop();
    onReady(false);
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  const contextRestored = () => {
    onReady(false);
    lost = true;
  };
  canvas.addEventListener("webglcontextrestored", contextRestored);
  const resized = () => draw(0);
  addEventListener("resize", resized);
  return {
    dispose() {
      stop();
      removeEventListener("resize", resized);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
    draw,
    sync,
    stop,
    get available() {
      return !lost;
    },
  };
}
