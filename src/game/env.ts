import * as THREE from 'three'

/**
 * Procedural neon-city environment (dusk gradient plus bright cyan / magenta / white light panels),
 * pre-filtered once with PMREM. It is what the glossy road, glass towers and metal hazards reflect.
 */
export function makeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 top = vec3(0.03, 0.05, 0.18);
          vec3 mid = vec3(0.32, 0.12, 0.46);
          vec3 low = vec3(0.02, 0.03, 0.09);
          vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, h)) : mix(mid, low, smoothstep(0.0, -0.5, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  scene.add(sky)

  const panel = (color: number, intensity: number, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    scene.add(m)
  }
  panel(0x35f2ff, 2.2, 40, 8, -34, 12, -14)
  panel(0xff3df0, 2.2, 40, 8, 34, 14, -18)
  panel(0xffffff, 1.6, 50, 30, 0, 42, 0)
  panel(0xffb066, 1.2, 36, 6, 0, 6, 42)
  panel(0x7a5cff, 1.2, 60, 5, 0, 8, -48)

  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(scene, 0.02)
  pm.dispose()
  sky.geometry.dispose()
  return rt.texture
}
