// A glass Christmas ornament rendered with Three.js. Loaded lazily and only on capable devices;
// callers show an SVG fallback otherwise. The ornament leans toward the pointer and slowly turns.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function gradientTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  // painted gold bands and stars
  g.strokeStyle = 'rgba(242,196,109,0.95)';
  g.lineWidth = 6;
  for (const y of [86, 170]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = 'rgba(255,240,200,0.95)';
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 29;
    const y = 128 + (i % 2 ? -12 : 12);
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 3 : 8;
      g.lineTo(x + Math.cos((k * Math.PI) / 5) * r, y + Math.sin((k * Math.PI) / 5) * r);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export default function Ornament3D({ c1 = '#c8102e', c2 = '#5a0614' }) {
  const mount = useRef(null);

  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 9.5);

    const group = new THREE.Group();
    scene.add(group);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 96, 96),
      new THREE.MeshPhysicalMaterial({ map: gradientTexture(c1, c2), roughness: 0.18, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4 }),
    );
    group.add(ball);
    const gold = new THREE.MeshStandardMaterial({ color: '#d4a537', metalness: 1, roughness: 0.28 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.42, 32), gold);
    cap.position.y = 1.62;
    group.add(cap);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 40), gold);
    loop.position.y = 1.98;
    group.add(loop);
    // thread up to the top of the frame
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4, 6), new THREE.MeshBasicMaterial({ color: '#f2c46d' }));
    thread.position.y = 4.1;
    group.add(thread);

    scene.add(new THREE.HemisphereLight('#bcd2ff', '#2a0f22', 1.1));
    const key = new THREE.PointLight('#ffe2a8', 60, 30);
    key.position.set(3, 3, 5);
    scene.add(key);
    const rim = new THREE.PointLight('#7fa8ff', 40, 30);
    rim.position.set(-4, -1, -2);
    scene.add(rim);

    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      target.x = (e.clientX / innerWidth - 0.5) * 0.6;
      target.y = (e.clientY / innerHeight - 0.5) * 0.4;
    };
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      ball.rotation.y = t * 0.35;
      group.rotation.z += (Math.sin(t * 0.8) * 0.08 + target.x * 0.4 - group.rotation.z) * 0.05;
      group.rotation.x += (target.y * 0.5 - group.rotation.x) * 0.05;
      group.position.y = Math.sin(t * 1.1) * 0.08 - 0.3;
      renderer.render(scene, camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      renderer.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
      el.removeChild(renderer.domElement);
    };
  }, [c1, c2]);

  return <div ref={mount} className="ornament-3d" aria-hidden="true" />;
}
