import { useEffect, useRef, useState } from 'react';

export default function TeacherSimulation() {
  const scatterCanvasRef = useRef<HTMLCanvasElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const TRACK_CENTER = { x: 32.0, y: 32.0 };
  const TRACK_RADIUS = 20.0;
  const SCALE = 5;

  // FIX 1: Echte Gauß-Normalverteilung (Box-Muller-Transformation)
  // Entspricht exakt np.random.normal(0, 1) in Python
  const randn = () => {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const simulateAndDraw = () => {
    setIsSimulating(true);
    const sCanvas = scatterCanvasRef.current;
    const hCanvas = histCanvasRef.current;
    if (!sCanvas || !hCanvas) return;

    const sCtx = sCanvas.getContext('2d');
    const hCtx = hCanvas.getContext('2d');
    if (!sCtx || !hCtx) return;

    const allPoints: { x: number; y: number }[] = [];
    const allErrors: number[] = [];
    let sampleTrajectory: { x: number; y: number }[] = [];

    const numEpisodes = 200;

    for (let ep = 0; ep < numEpisodes; ep++) {
      const alpha = Math.random() * 2 * Math.PI;
      const spawnRadius = TRACK_RADIUS + (Math.random() * 20.0 - 10.0);

      let x = TRACK_CENTER.x + spawnRadius * Math.cos(alpha);
      let y = TRACK_CENTER.y + spawnRadius * Math.sin(alpha);

      const tangentAngle = alpha + Math.PI / 2.0;
      let theta = tangentAngle + (Math.random() * 3.0 - 1.5);
      let velocity = Math.random() * 5.0;

      const currentTrajectory = [];

      for (let step = 0; step < 200; step++) {
        allPoints.push({ x, y });
        currentTrajectory.push({ x, y });

        const dist = Math.sqrt((x - TRACK_CENTER.x) ** 2 + (y - TRACK_CENTER.y) ** 2);
        const error = Math.abs(dist - TRACK_RADIUS);
        allErrors.push(error);

        const angleFromCenter = Math.atan2(y - TRACK_CENTER.y, x - TRACK_CENTER.x);
        const lookaheadAngle = angleFromCenter + 0.5;
        const targetX = TRACK_CENTER.x + TRACK_RADIUS * Math.cos(lookaheadAngle);
        const targetY = TRACK_CENTER.y + TRACK_RADIUS * Math.sin(lookaheadAngle);

        const idealHeading = Math.atan2(targetY - y, targetX - x);
        let steerError = idealHeading - theta;

        // FIX 2: Echter mathematischer Modulo in JavaScript
        const twoPi = 2 * Math.PI;
        steerError = ((((steerError + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;

        let steerAction = 0;
        if (Math.random() < 0.1) {
          steerAction = Math.random() < 0.5 ? -1.0 : 1.0;
        } else {
          steerAction = steerError * 2.5 + randn() * 0.2;
        }

        steerAction = Math.max(Math.min(steerAction, 1.0), -1.0);
        let accelAction = Math.max(Math.min(0.6 + randn() * 0.2, 1.0), -1.0);

        velocity = velocity * 0.95 + accelAction;
        velocity = Math.max(Math.min(velocity, 10.0), -10.0);
        theta += steerAction * (velocity * 0.1);
        x += velocity * Math.cos(theta);
        y += velocity * Math.sin(theta);

        if (error > 15.0) break;
      }

      if (ep === 0) sampleTrajectory = currentTrajectory;
    }

    // SCATTER PLOT ZEICHNEN
    sCtx.fillStyle = '#f8fafc';
    sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

    sCtx.beginPath();
    sCtx.arc(TRACK_CENTER.x * SCALE, TRACK_CENTER.y * SCALE, TRACK_RADIUS * SCALE, 0, 2 * Math.PI);
    sCtx.strokeStyle = '#ef4444';
    sCtx.lineWidth = 2;
    sCtx.setLineDash([5, 5]);
    sCtx.stroke();
    sCtx.setLineDash([]);

    sCtx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    allPoints.forEach((p) => {
      sCtx.beginPath();
      sCtx.arc(p.x * SCALE, p.y * SCALE, 1.5, 0, 2 * Math.PI);
      sCtx.fill();
    });

    if (sampleTrajectory.length > 0) {
      sCtx.beginPath();
      sCtx.moveTo(sampleTrajectory[0].x * SCALE, sampleTrajectory[0].y * SCALE);
      for (let i = 1; i < sampleTrajectory.length; i++) {
        sCtx.lineTo(sampleTrajectory[i].x * SCALE, sampleTrajectory[i].y * SCALE);
      }
      sCtx.strokeStyle = '#1e3a8a';
      sCtx.lineWidth = 2;
      sCtx.stroke();

      sCtx.beginPath();
      sCtx.arc(sampleTrajectory[0].x * SCALE, sampleTrajectory[0].y * SCALE, 4, 0, 2 * Math.PI);
      sCtx.fillStyle = '#1e3a8a';
      sCtx.fill();
    }

    // HISTOGRAMM ZEICHNEN
    hCtx.fillStyle = '#f8fafc';
    hCtx.fillRect(0, 0, hCanvas.width, hCanvas.height);

    const numBins = 50;
    const maxErrorAxis = 20.0;
    const bins = new Array(numBins).fill(0);

    allErrors.forEach((err) => {
      const idx = Math.floor((err / maxErrorAxis) * numBins);
      if (idx >= 0 && idx < numBins) bins[idx]++;
    });

    const maxFreq = Math.max(...bins, 1);
    const padding = 20;
    const histWidth = hCanvas.width - 2 * padding;
    const histHeight = hCanvas.height - 2 * padding - 15;
    const binWidth = histWidth / numBins;

    hCtx.fillStyle = 'rgba(168, 85, 247, 0.7)';
    bins.forEach((freq, i) => {
      const barHeight = (freq / maxFreq) * histHeight;
      const rx = padding + i * binWidth;
      const ry = hCanvas.height - padding - 15 - barHeight;
      hCtx.fillRect(rx, ry, binWidth - 1, barHeight);
    });

    const thresholdX = padding + (15.0 / maxErrorAxis) * histWidth;
    hCtx.beginPath();
    hCtx.moveTo(thresholdX, padding);
    hCtx.lineTo(thresholdX, hCanvas.height - padding - 15);
    hCtx.strokeStyle = '#ef4444';
    hCtx.lineWidth = 2;
    hCtx.setLineDash([5, 5]);
    hCtx.stroke();
    hCtx.setLineDash([]);

    hCtx.fillStyle = '#64748b';
    hCtx.font = '10px sans-serif';
    hCtx.textAlign = 'center';
    hCtx.fillText('0', padding, hCanvas.height - 10);
    hCtx.fillText('20', hCanvas.width - padding, hCanvas.height - 10);
    hCtx.fillText('Cross-Track Error (Pixels)', hCanvas.width / 2, hCanvas.height - 5);

    hCtx.fillStyle = '#ef4444';
    hCtx.fillText('Threshold (15)', thresholdX, padding - 5);

    setIsSimulating(false);
  };

  useEffect(() => {
    simulateAndDraw();
  }, []);

  return (
    <div className="not-prose my-10 flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 text-center">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Out-of-Distribution (OOD) Coverage</h3>
        <p className="text-sm text-gray-500">
          Spatial distribution vs. Cross-Track Error variance across 100 simulated episodes.
        </p>
      </div>

      <div className="mb-6 grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center">
          <span className="mb-2 font-mono text-xs text-gray-400">1. SPATIAL DISTRIBUTION</span>
          <canvas
            ref={scatterCanvasRef}
            width={320}
            height={320}
            className="w-full max-w-[320px] rounded border border-gray-300 bg-slate-50"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="mb-2 font-mono text-xs text-gray-400">2. TRACK ERROR DISTRIBUTION</span>
          <canvas
            ref={histCanvasRef}
            width={320}
            height={320}
            className="w-full max-w-[320px] rounded border border-gray-300 bg-slate-50"
          />
        </div>
      </div>

      <button
        onClick={simulateAndDraw}
        disabled={isSimulating}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        Re-Simulate Teacher
      </button>
    </div>
  );
}
