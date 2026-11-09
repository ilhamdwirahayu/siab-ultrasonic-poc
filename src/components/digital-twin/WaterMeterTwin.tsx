"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  Line,
  OrbitControls,
  RoundedBox,
  Tube,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AlertTriangle, Box, Camera, Expand, Gauge, Moon, RotateCcw, Sun, Waves } from "lucide-react";
import { Component, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import * as THREE from "three";
import type { DeviceWithLatest } from "@/types/telemetry";
import { formatDateTime, formatNumber } from "@/lib/format";

type SceneNode = "PDAM INLET" | "VALVE / UNION" | "ULTRASONIC METER" | "PIPE NETWORK" | "WATER TANK" | "HOUSE" | "LORAWAN GATEWAY";
type TwinMode = "engineering" | "live";
type SceneTheme = "light" | "dark";

interface WaterMeterTwinProps {
  device: DeviceWithLatest | null;
}

const routePoints = [
  new THREE.Vector3(-4.3, -0.55, 0),
  new THREE.Vector3(-3.2, -0.55, 0),
  new THREE.Vector3(-1.6, -0.55, 0),
  new THREE.Vector3(-0.45, -0.55, 0),
  new THREE.Vector3(-0.45, 0.1, 0),
  new THREE.Vector3(-0.45, 1.45, 0),
  new THREE.Vector3(0.7, 1.55, 0),
  new THREE.Vector3(1.65, 1.55, 0),
  new THREE.Vector3(2.2, 1.8, 0),
  new THREE.Vector3(2.85, 2.0, 0),
];

export default function WaterMeterTwin({ device }: WaterMeterTwinProps) {
  const [mode, setMode] = useState<TwinMode>("engineering");
  const [sceneTheme, setSceneTheme] = useState<SceneTheme>("light");
  const [autoRotate, setAutoRotate] = useState(false);
  const [transparentPipes, setTransparentPipes] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SceneNode>("ULTRASONIC METER");
  const [webglFailed, setWebglFailed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const reading = device?.latest ?? null;
  const reportedFlow = reading?.flowM3PerHour;
  const flow = typeof reportedFlow === "number" && Number.isFinite(reportedFlow) && reportedFlow >= 0
    ? reportedFlow
    : null;
  const reportedTotalizer = reading?.forwardM3;
  const totalizer = typeof reportedTotalizer === "number" && Number.isFinite(reportedTotalizer) && reportedTotalizer >= 0
    ? reportedTotalizer
    : null;
  const actualFlow = mode === "live" && flow !== null && flow > 0;
  const knownMeasurement = flow !== null;

  function resetCamera() {
    controlsRef.current?.reset();
  }

  async function toggleFullscreen() {
    if (!stageRef.current) return;
    if (document.fullscreenElement === stageRef.current) {
      await document.exitFullscreen();
      return;
    }
    await stageRef.current.requestFullscreen();
  }

  return (
    <div className={`engineering-twin twin-${sceneTheme}`} ref={stageRef}>
      <div className="twin-toolbar" aria-label="Kontrol digital twin">
        <div className="twin-mode-switch" role="group" aria-label="Mode visualisasi">
          <button type="button" className={mode === "engineering" ? "selected" : ""} onClick={() => setMode("engineering")}>Engineering Illustration</button>
          <button type="button" className={mode === "live" ? "selected" : ""} onClick={() => setMode("live")}>Live Measurement</button>
        </div>
        <div className="twin-actions">
          <button type="button" aria-label="Ganti tema scene" title={`Tema ${sceneTheme === "light" ? "gelap" : "terang"}`} onClick={() => setSceneTheme((theme) => theme === "light" ? "dark" : "light")}>
            {sceneTheme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button type="button" aria-label="Toggle transparansi pipa" aria-pressed={transparentPipes} title="Transparansi pipa" onClick={() => setTransparentPipes((value) => !value)}><Waves size={15} /></button>
          <button type="button" aria-label="Toggle partikel aliran" aria-pressed={showParticles} title="Partikel aliran" onClick={() => setShowParticles((value) => !value)}><Gauge size={15} /></button>
          <button type="button" aria-label={autoRotate ? "Hentikan rotasi otomatis" : "Mulai rotasi otomatis"} aria-pressed={autoRotate} title="Rotasi otomatis" onClick={() => setAutoRotate((value) => !value)}><RotateCcw size={15} /></button>
          <button type="button" aria-label="Reset kamera" title="Reset kamera" onClick={resetCamera}><Camera size={15} /></button>
          <button type="button" aria-label="Layar penuh" title="Layar penuh" onClick={() => void toggleFullscreen()}><Expand size={15} /></button>
        </div>
      </div>

      <div className="twin-scene" role="img" aria-label="Digital twin skematik jaringan air, meter ultrasonik dan gateway LoRaWAN">
        {webglFailed ? (
          <div className="twin-fallback" role="status"><AlertTriangle size={22} />WebGL tidak tersedia. Informasi telemetri tetap ditampilkan di panel meter.</div>
        ) : (
          <SceneErrorBoundary onError={() => setWebglFailed(true)}>
            <Canvas
              dpr={[1, 1.35]}
              camera={{ position: [6.8, 5.2, 9.3], fov: 40 }}
              gl={{ antialias: true, powerPreference: "low-power" }}
              fallback={<div className="twin-fallback">WebGL tidak tersedia pada perangkat ini.</div>}
            >
              <color attach="background" args={[sceneTheme === "light" ? "#eaf2f8" : "#101c2a"]} />
              <ambientLight intensity={sceneTheme === "light" ? 1.55 : 0.72} />
              <directionalLight position={[4, 8, 5]} intensity={sceneTheme === "light" ? 2.2 : 1.25} />
              <pointLight position={[-3, 1, 3]} color="#38BDF8" intensity={sceneTheme === "light" ? 1.6 : 1.1} />
              <gridHelper args={[12, 24, sceneTheme === "light" ? "#b9d1e2" : "#26394b", sceneTheme === "light" ? "#d2e0eb" : "#203144"]} position={[0, -1.08, 0]} />
              <NetworkScene
                device={device}
                flow={flow}
                totalizer={totalizer}
                actualFlow={actualFlow}
                showParticles={showParticles}
                transparentPipes={transparentPipes}
                selectedNode={selectedNode}
                onSelect={setSelectedNode}
              />
              <OrbitControls
                ref={controlsRef}
                makeDefault
                autoRotate={autoRotate}
                autoRotateSpeed={0.28}
                enablePan
                minDistance={5}
                maxDistance={16}
                maxPolarAngle={Math.PI * 0.48}
                target={[0, 0.75, 0]}
              />
            </Canvas>
          </SceneErrorBoundary>
        )}

        <div className={`twin-flow-state ${actualFlow ? "flow-actual" : knownMeasurement ? "flow-zero" : "flow-unknown"}`} role="status">
          {actualFlow
            ? <><span className="flow-live-pulse" /><strong>MEASURED FLOW</strong><span>{formatNumber(flow)} m³/jam</span></>
            : knownMeasurement
              ? <><span className="flow-state-mark" /><strong>MEASURED: 0 m³/h</strong><span>Aliran terukur diam</span></>
              : <><span className="flow-state-mark" /><strong>SCHEMATIC VISUALIZATION</strong><span>Flow measurement unavailable</span></>}
        </div>
        <div className="twin-scene-caption"><Box size={13} />Skema engineering · tidak berdasarkan dimensi fisik terverifikasi</div>
      </div>

      <div className="twin-bottom">
        <div className="twin-network-path"><span>Meter</span><i /> <span>Gateway</span><i /> <span>ANTARES</span><i /> <span>Supabase</span></div>
        <div className="twin-selection" aria-live="polite">
          <strong>{selectedNode}</strong>
          <span>{getNodeDescription(selectedNode)}</span>
        </div>
      </div>

      {selectedNode === "ULTRASONIC METER" && (
        <aside className="twin-meter-data" aria-label="Data pengukuran meter">
          <div className="twin-meter-data-heading"><strong>SIAB Ultrasonic 213E | DN15</strong><span>{device?.serial ?? "26261652"}</span></div>
          <div className="twin-meter-data-grid">
            <TwinMetric label="Serial" value={device?.serial ?? "26261652"} />
            <TwinMetric label="DevEUI" value={device?.devEui ?? null} />
            <TwinMetric label="Debit" value={flow === null ? null : `${formatNumber(flow)} m³/jam`} />
            <TwinMetric label="Volume forward" value={reading?.forwardM3 === null || reading?.forwardM3 === undefined ? null : `${formatNumber(reading.forwardM3)} m³`} />
            <TwinMetric label="Temperatur" value={reading?.temperatureC === null || reading?.temperatureC === undefined ? null : `${formatNumber(reading.temperatureC)} °C`} />
            <TwinMetric label="Last uplink" value={reading?.receivedAt ? `${formatDateTime(reading.receivedAt)} WIB` : null} />
            <TwinMetric label="RSSI / SNR" value={reading?.rssi === null || reading?.rssi === undefined ? null : `${formatNumber(reading.rssi, 0)} dBm / ${formatNumber(reading.snr)} dB`} />
            <TwinMetric label="Decode status" value={reading?.decodeStatus ?? null} />
          </div>
        </aside>
      )}
    </div>
  );
}

function NetworkScene({
  device,
  flow,
  totalizer,
  actualFlow,
  showParticles,
  transparentPipes,
  selectedNode,
  onSelect,
}: {
  device: DeviceWithLatest | null;
  flow: number | null;
  totalizer: number | null;
  actualFlow: boolean;
  showParticles: boolean;
  transparentPipes: boolean;
  selectedNode: SceneNode;
  onSelect: (node: SceneNode) => void;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(routePoints), []);
  const pulse = actualFlow;

  return (
    <group>
      <mesh position={[0, -1.18, 0]} receiveShadow>
        <boxGeometry args={[12, 0.16, 5]} />
        <meshStandardMaterial color="#dce8f0" roughness={0.92} />
      </mesh>

      <Selectable node="PDAM INLET" selectedNode={selectedNode} onSelect={onSelect}>
        <group position={[-4.25, -0.3, 0]}>
          <RoundedBox args={[0.65, 0.84, 0.65]} radius={0.08}>
            <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
          </RoundedBox>
          <mesh position={[0.15, 0, 0.36]}>
            <circleGeometry args={[0.16, 32]} />
            <meshStandardMaterial color="#1976D2" emissive="#1976D2" emissiveIntensity={0.2} />
          </mesh>
          <NodeLabel title="PDAM INLET" detail="Supply masuk" position={[0, 0.7, 0.12]} />
        </group>
      </Selectable>

      <Selectable node="PIPE NETWORK" selectedNode={selectedNode} onSelect={onSelect}>
        <PipePath curve={curve} radius={0.12} transparent={transparentPipes} pulse={pulse} />
        <PipePath
          curve={new THREE.CatmullRomCurve3([
            new THREE.Vector3(2.85, 2.0, 0),
            new THREE.Vector3(3.35, 1.7, 0),
            new THREE.Vector3(3.55, 1.0, 0),
            new THREE.Vector3(3.0, 0.48, 0),
          ])}
          radius={0.1}
          transparent={transparentPipes}
          pulse={pulse}
        />
        <TransitionFitting position={[-0.45, -0.53, 0]} />
        <TransitionFitting position={[-0.45, 1.42, 0]} />
        <TransitionFitting position={[1.65, 1.55, 0]} />
        {actualFlow && <FlowArrow active position={[-0.05, 1.58, 0.16]} />}
        {actualFlow && showParticles && <FlowParticles curve={curve} flow={flow ?? 0} />}
      </Selectable>

      <Selectable node="VALVE / UNION" selectedNode={selectedNode} onSelect={onSelect}>
        <group position={[-1.55, -0.55, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.32, 24]} />
            <meshStandardMaterial color="#647b8d" metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.34, 12]} />
            <meshStandardMaterial color="#1976D2" metalness={0.5} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <torusGeometry args={[0.16, 0.035, 8, 24]} />
            <meshStandardMaterial color="#1976D2" metalness={0.48} roughness={0.34} />
          </mesh>
          <NodeLabel title="VALVE / UNION" detail="Fitting transisi" position={[0, 0.86, 0.1]} />
        </group>
      </Selectable>

      <Selectable node="ULTRASONIC METER" selectedNode={selectedNode} onSelect={onSelect}>
        <MeterModel
          serial={device?.serial ?? "26261652"}
          flow={flow}
          temperature={device?.latest?.temperatureC ?? null}
          totalizer={totalizer}
          actualFlow={actualFlow}
        />
      </Selectable>

      <Selectable node="WATER TANK" selectedNode={selectedNode} onSelect={onSelect}>
        <WaterTank position={[2.8, 2.58, 0]} />
      </Selectable>

      <Selectable node="HOUSE" selectedNode={selectedNode} onSelect={onSelect}>
        <HouseModel position={[2.95, -0.35, -0.35]} />
      </Selectable>

      <Selectable node="LORAWAN GATEWAY" selectedNode={selectedNode} onSelect={onSelect}>
        <Gateway position={[-2.9, 2.75, 0.05]} />
      </Selectable>

      <Line
        points={[[-2.85, 2.48, 0.05], [-2.2, 1.9, 0.05], [-1.4, 1.38, 0.05], [-0.45, 1.05, 0.05]]}
        color="#1976D2"
        lineWidth={1}
        dashed
        dashSize={0.12}
        gapSize={0.1}
        transparent
        opacity={0.75}
      />
    </group>
  );
}

function MeterModel({
  serial,
  flow,
  temperature,
  totalizer,
  actualFlow,
}: {
  serial: string;
  flow: number | null;
  temperature: number | null;
  totalizer: number | null;
  actualFlow: boolean;
}) {
  const validFlow = flow !== null && Number.isFinite(flow) ? formatNumber(flow) : "—";
  const validTotal = totalizer !== null && Number.isFinite(totalizer) ? formatNumber(totalizer) : "—";
  const validTemp = temperature !== null && Number.isFinite(temperature) ? formatNumber(temperature) : "—";

  return (
    <group position={[-0.45, 0.83, 0]}>
      <RoundedBox args={[0.82, 1.0, 0.48]} radius={0.095} smoothness={5} castShadow>
        <meshStandardMaterial color="#F8FAFC" roughness={0.34} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[0.84, 0.18, 0.5]} radius={0.07} position={[0, 0.58, 0]} castShadow>
        <meshStandardMaterial color="#1976D2" roughness={0.32} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.58, 0.37, 0.055]} radius={0.035} position={[0, 0.15, 0.26]}>
        <meshStandardMaterial color="#1c2b38" roughness={0.28} />
      </RoundedBox>
      <RoundedBox args={[0.47, 0.245, 0.014]} radius={0.018} position={[0, 0.16, 0.295]}>
        <meshStandardMaterial color="#b4eaf5" emissive="#38BDF8" emissiveIntensity={0.18} roughness={0.3} />
      </RoundedBox>
      <Html position={[0, 0.16, 0.31]} center transform distanceFactor={5.5} occlude={false} className="meter-screen-html">
        <div className="meter-screen">
          <strong>SIAB · 213E</strong>
          <span>{validFlow} m³/h</span>
          <small>{validTotal} m³ · {validTemp}°C</small>
        </div>
      </Html>
      <RoundedBox args={[0.48, 0.11, 0.025]} radius={0.015} position={[0, -0.16, 0.254]}>
        <meshStandardMaterial color="#e5edf2" roughness={0.55} />
      </RoundedBox>
      <Html position={[0, -0.16, 0.276]} center transform distanceFactor={5.5} occlude={false}>
        <div className="meter-logo">SIAB <small>ULTRASONIC WATER METER</small></div>
      </Html>
      <Html position={[0, -0.39, 0.26]} center transform distanceFactor={5.5} occlude={false}>
        <div className="meter-serial">213E · DN15 · {serial}</div>
      </Html>
      {[-1, 1].map((side) => [-1, 1].map((vertical) => (
        <mesh key={`${side}-${vertical}`} position={[side * 0.32, vertical * 0.39, 0.258]}>
          <cylinderGeometry args={[0.025, 0.025, 0.022, 16]} />
          <meshStandardMaterial color="#8697a1" metalness={0.72} roughness={0.28} />
        </mesh>
      )))}
      <PipeUnion position={[0, -0.67, 0]} />
      <PipeUnion position={[0, 0.67, 0]} />
      <NodeLabel title="SIAB ULTRASONIC 213E" detail="DN15 · aliran naik ke tandon" position={[0, 1.0, 0.22]} />
      {actualFlow && (
        <group position={[0.69, -0.02, 0.13]}>
          <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.012, 0.012, 0.37, 8]} /><meshStandardMaterial color="#1976D2" /></mesh>
          <mesh position={[0, 0.43, 0]}><coneGeometry args={[0.06, 0.13, 12]} /><meshStandardMaterial color="#1976D2" /></mesh>
          <Html position={[0.08, 0.24, 0]}><span className="flow-direction-label">FLOW UP</span></Html>
        </group>
      )}
    </group>
  );
}

function PipePath({ curve, radius, transparent, pulse }: { curve: THREE.CatmullRomCurve3; radius: number; transparent: boolean; pulse: boolean }) {
  return (
    <group>
      <Tube args={[curve, 80, radius, 12, false]}>
        <meshPhysicalMaterial color="#38BDF8" roughness={0.18} metalness={0.05} transparent={transparent} opacity={transparent ? 0.27 : 0.88} transmission={transparent ? 0.28 : 0} thickness={0.12} depthWrite={!transparent} />
      </Tube>
      <Tube args={[curve, 80, radius * 0.56, 10, false]}>
        <WaterMaterial pulse={pulse} />
      </Tube>
    </group>
  );
}

function WaterMaterial({ pulse }: { pulse: boolean }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!materialRef.current || !pulse) return;
    materialRef.current.emissiveIntensity = 0.16 + (Math.sin(clock.elapsedTime * 1.35) + 1) * 0.12;
  });
  return <meshStandardMaterial ref={materialRef} color="#38BDF8" emissive="#0ea5e9" emissiveIntensity={0.25} roughness={0.22} transparent opacity={0.82} />;
}

function FlowParticles({ curve, flow }: { curve: THREE.CatmullRomCurve3; flow: number }) {
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const normalizedSpeed = Math.min(Math.max(flow / 2.5, 0.08), 1.5);
  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const time = clock.elapsedTime * 0.055 * normalizedSpeed;
    for (let index = 0; index < 10; index += 1) {
      const progress = (index / 10 + time) % 1;
      const point = curve.getPointAt(progress);
      helper.position.copy(point);
      helper.scale.setScalar(index % 3 === 0 ? 0.095 : 0.065);
      helper.updateMatrix();
      particlesRef.current.setMatrixAt(index, helper.matrix);
    }
    particlesRef.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={particlesRef} args={[undefined, undefined, 10]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#d8fbff" />
    </instancedMesh>
  );
}

function PipeUnion({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.15, 20]} />
        <meshStandardMaterial color="#8295a1" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.15, 0.025, 8, 24]} />
        <meshStandardMaterial color="#d5e0e6" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function TransitionFitting({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.085, 0.28, 20]} />
        <meshStandardMaterial color="#647b8d" metalness={0.58} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <torusGeometry args={[0.12, 0.018, 8, 24]} />
        <meshStandardMaterial color="#c6d3db" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FlowArrow({ active, position }: { active: boolean; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[active ? 0.13 : 0.095, active ? 0.3 : 0.22, 16]} />
        <meshStandardMaterial color={active ? "#1976D2" : "#78a5ba"} emissive={active ? "#1976D2" : "#000000"} emissiveIntensity={active ? 0.32 : 0} />
      </mesh>
    </group>
  );
}

function WaterTank({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -0.28, 0]} castShadow>
        <cylinderGeometry args={[0.56, 0.48, 0.82, 32]} />
        <meshStandardMaterial color="#F97316" roughness={0.38} metalness={0.03} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#fb862f" roughness={0.38} />
      </mesh>
      {[0.25, 0.05, -0.16, -0.38, -0.58].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[y > 0.05 ? 0.48 : 0.5, 0.018, 8, 32]} />
          <meshStandardMaterial color="#c94d0a" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.08, 24]} />
        <meshStandardMaterial color="#a83c0a" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.75, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.12, 24]} />
        <meshStandardMaterial color="#5b6d79" metalness={0.42} roughness={0.48} />
      </mesh>
      <NodeLabel title="TANDON AIR" detail="Tangki rumah tangga · ilustrasi" position={[0, 0.72, 0.15]} />
    </group>
  );
}

function HouseModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[2.2, 1.4, 1.45]} radius={0.05} position={[0, 0, 0]} castShadow>
        <meshStandardMaterial color="#f4f7f8" roughness={0.82} />
      </RoundedBox>
      <mesh position={[0, 0.89, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[1.7, 0.16, 1.7]} />
        <meshStandardMaterial color="#536b7d" roughness={0.72} />
      </mesh>
      <mesh position={[0.52, 0.89, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <boxGeometry args={[1.7, 0.16, 1.7]} />
        <meshStandardMaterial color="#536b7d" roughness={0.72} />
      </mesh>
      <RoundedBox args={[0.42, 0.82, 0.07]} radius={0.025} position={[-0.1, -0.28, 0.76]}>
        <meshStandardMaterial color="#1976D2" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.48, 0.42, 0.06]} radius={0.025} position={[0.62, 0.18, 0.76]}>
        <meshStandardMaterial color="#8fe0f0" emissive="#38BDF8" emissiveIntensity={0.12} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0.15, 0.78, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.18]} />
        <meshStandardMaterial color="#a8b7c0" roughness={0.8} />
      </mesh>
      <NodeLabel title="RUMAH" detail="Distribusi pemakaian" position={[0, 1.45, 0.3]} />
    </group>
  );
}

function Gateway({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.58, 0.74, 0.3]} radius={0.07} castShadow>
        <meshStandardMaterial color="#203a52" roughness={0.32} metalness={0.28} />
      </RoundedBox>
      <mesh position={[0, 0.04, 0.16]}>
        <circleGeometry args={[0.09, 24]} />
        <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.19, 0.55, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
        <meshStandardMaterial color="#607c91" metalness={0.62} roughness={0.3} />
      </mesh>
      <NodeLabel title="LORAWAN GATEWAY" detail="Radio link · terpisah dari pipa" position={[0, 0.86, 0.1]} />
    </group>
  );
}

function NodeLabel({ title, detail, position }: { title: string; detail: string; position: [number, number, number] }) {
  return (
    <Html position={position} center distanceFactor={9} occlude={false} className="engineering-node-label">
      <div><strong>{title}</strong><span>{detail}</span></div>
    </Html>
  );
}

function Selectable({
  node,
  selectedNode,
  onSelect,
  children,
}: {
  node: SceneNode;
  selectedNode: SceneNode;
  onSelect: (node: SceneNode) => void;
  children: ReactNode;
}) {
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {children}
      {selectedNode === node && <mesh position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.49, 48]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.45} />
      </mesh>}
    </group>
  );
}

function TwinMetric({ label, value }: { label: string; value: string | null }) {
  return <div><span>{label}</span><strong>{value ?? "—"}</strong></div>;
}

function getNodeDescription(node: SceneNode): string {
  const descriptions: Record<SceneNode, string> = {
    "PDAM INLET": "Titik supply skematik ke jaringan pelanggan.",
    "VALVE / UNION": "Valve dan fitting transisi digambarkan secara konseptual.",
    "ULTRASONIC METER": "Meter diletakkan pada riser berisi air dengan orientasi aliran ke atas.",
    "PIPE NETWORK": "Shell pipa transparan memperlihatkan air skematik di dalam jalur.",
    "WATER TANK": "Tandon rumah tangga berada di atas struktur rumah.",
    HOUSE: "Bangunan ilustratif untuk konteks distribusi dan konsumsi.",
    "LORAWAN GATEWAY": "Gateway menerima radio LoRaWAN; bukan komponen jalur air.",
  };
  return descriptions[node];
}

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Digital twin scene failed to render.", error, info);
    this.props.onError();
  }

  render() {
    return this.state.failed
      ? <div className="twin-fallback" role="status"><AlertTriangle size={22} />Scene 3D tidak dapat dirender di browser ini.</div>
      : this.props.children;
  }
}
