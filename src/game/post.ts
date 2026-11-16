import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAb: { value: 0.0003 },
    uVig: { value: 0.3 },
    uSat: { value: 1.06 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAb;
    uniform float uVig;
    uniform float uSat;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uAb * 3.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col *= 1.0 - uVig * smoothstep(0.1, 0.55, r2 * 1.9);
      col = max(vec3(0.0), (col - 0.1) * 1.14 + 0.1);
      col += (hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * 0.004;
      gl_FragColor = vec4(col, 1.0);
    }`,
}

/** Cinematic pipeline: HDR render, bloom on the neon, chromatic aberration / vignette / grain grade, then tone mapping. */
export class PostFX {
  readonly composer: EffectComposer
  readonly bloom: UnrealBloomPass
  private grade: ShaderPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, pixelRatio: number, msaa: boolean) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa ? 4 : 0 })
    this.composer = new EffectComposer(renderer, rt)
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(w, h)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.3, 1.05)
    this.composer.addPass(this.bloom)
    this.grade = new ShaderPass(GradeShader)
    this.composer.addPass(this.grade)
    this.composer.addPass(new OutputPass())
  }

  resize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(w, h)
  }

  setBloom(on: boolean): void {
    this.bloom.enabled = on
  }

  /** speedNorm 0..1 and surge drive the lens effects so speed is felt, not just seen */
  render(dt: number, time: number, speedNorm: number, surge: boolean): void {
    const u = this.grade.uniforms
    u.uTime.value = time % 100
    const ab = 0.0003 + speedNorm * 0.0006 + (surge ? 0.0005 : 0)
    u.uAb.value += (ab - u.uAb.value) * Math.min(1, dt * 6)
    u.uVig.value = 0.3 + speedNorm * 0.12
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
  }
}
