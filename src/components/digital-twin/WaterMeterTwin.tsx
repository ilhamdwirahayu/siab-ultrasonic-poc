"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Sparkles } from "@react-three/drei";
import { useEffect, useState } from "react";

function MeterModel({ flow }: { flow: number | null }) {
  const flowing = flow !== null && flow > 0;
  return (
    <group rotation={[0.12, -0.22, 0]}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.9, 48]} />
        <meshStandardMaterial color="#b4c8d1" metalness={0.75} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.16, 48]} />
        <meshStandardMaterial color="#dce8e7" metalness={0.35} roughness={0.3} />
      </mesh>
      <RoundedBox args={[0.64, 0.35, 0.16]} radius={0.055} position={[0, 0.53, 0.12]} castShadow>
        <meshStandardMaterial color="#173a45" roughness={0.28} />
      </RoundedBox>
      <mesh position={[0, 0.54, 0.21]}>
        <planeGeometry args={[0.43, 0.18]} />
        <meshBasicMaterial color={flowing ? "#7ce6bc" : "#b3f3df"} />
      </mesh>
      {[0, 1].map((side) => (
        <group key={side} position={[side ? 0.77 : -0.77, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.62, 32]} />
            <meshStandardMaterial color="#9bafb9" metalness={0.8} roughness={0.24} />
          </mesh>
          <mesh position={[0, side ? 0.26 : -0.26, 0]}>
            <torusGeometry args={[0.2, 0.035, 8, 32]} />
            <meshStandardMaterial color="#6e8691" metalness={0.8} />
          </mesh>
        </group>
      ))}
      {flowing && <Sparkles count={18} scale={[2.8, 1.3, 1.3]} size={2} speed={0.4} color="#29c99e" />}
    </group>
  );
}

export default function WaterMeterTwin({ flow }: { flow: number | null }) {
  const [autoRotate, setAutoRotate] = useState(flow !== null && flow > 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setAutoRotate(flow !== null && flow > 0), 0);
    return () => window.clearTimeout(timer);
  }, [flow]);

  return (
    <div className="twin-stage">
      <Canvas camera={{ position: [2.4, 1.8, 3.2], fov: 40 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, 4]} intensity={3} castShadow />
        <pointLight position={[-3, -2, 2]} intensity={1} color="#73dbc7" />
        <MeterModel flow={flow} />
        <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.8} enablePan={false} minDistance={2.4} maxDistance={6} />
      </Canvas>
      <button className="twin-control" type="button" onClick={() => setAutoRotate((value) => !value)}>
        {autoRotate ? "Jeda putaran" : "Putar otomatis"}
      </button>
      <span className="twin-label">VISUALISASI PRIMITIF · ILUSTRASI</span>
    </div>
  );
}
