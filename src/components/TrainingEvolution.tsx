import { useEffect, useRef, useState } from 'react';

interface Metrics {
  train_loss: number[];
  val_loss: number[];
  recon_loss: number[];
  epochs: number;
}

export default function TrainingEvolution() {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const reconCanvasRef = useRef<HTMLCanvasElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [epoch, setEpoch] = useState(0);

  const spriteImgRef = useRef<HTMLImageElement | null>(null);
  const origImgRef = useRef<HTMLImageElement | null>(null);

  // Daten und Bilder einmalig laden
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL;

    fetch(`${basePath}worldmodel/vae/training_metrics.json`)
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data);
        setEpoch(data.epochs - 1); // Start beim finalen Modell
      });

    const sprite = new Image();
    sprite.src = `${basePath}worldmodel/vae/reconstructions_sprite.png`;
    spriteImgRef.current = sprite;

    const orig = new Image();
    orig.src = `${basePath}worldmodel/vae/original_image.png`;
    orig.onload = () => {
      origImgRef.current = orig;
      // Originalbild einmalig zeichnen
      const ctx = origCanvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(orig, 0, 0, 256, 256);
      }
    };
  }, []);

  // Chart zeichnen, wenn sich die Epoche ändert
  useEffect(() => {
    if (!metrics) return;
    const canvas = chartCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const padding = 20;

    // Hintergrund
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // Skalierung berechnen
    // Wir fokussieren uns auf den Recon Loss (da dieser das Grokking am besten zeigt)
    const maxLoss = Math.max(...metrics.recon_loss.slice(1)); // Ignoriere Epoche 0 für besseren Zoom
    const minLoss = Math.min(...metrics.recon_loss);

    const scaleX = (w - 2 * padding) / (metrics.epochs - 1);
    const scaleY = (h - 2 * padding) / (maxLoss - minLoss);

    const getY = (val: number) => h - padding - (val - minLoss) * scaleY;
    const getX = (ep: number) => padding + ep * scaleX;

    // Achsen
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    // Loss-Kurve zeichnen
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(metrics.recon_loss[0]));
    for (let i = 1; i < metrics.epochs; i++) {
      ctx.lineTo(getX(i), getY(metrics.recon_loss[i]));
    }
    ctx.strokeStyle = '#ef4444'; // Rot
    ctx.lineWidth = 2;
    ctx.stroke();

    // Markierungslinie für die aktuelle Epoche
    const currX = getX(epoch);
    ctx.beginPath();
    ctx.moveTo(currX, padding);
    ctx.lineTo(currX, h - padding);
    ctx.strokeStyle = '#3b82f6'; // Blau
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Punkt auf der Kurve
    ctx.beginPath();
    ctx.arc(currX, getY(metrics.recon_loss[epoch]), 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    // Sprite-Sheet Ausschnitt rendern
    const rCtx = reconCanvasRef.current?.getContext('2d');
    if (rCtx && spriteImgRef.current && spriteImgRef.current.complete) {
      rCtx.imageSmoothingEnabled = false;
      rCtx.clearRect(0, 0, 256, 256);
      // (Bild, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH)
      rCtx.drawImage(
        spriteImgRef.current,
        epoch * 64,
        0,
        64,
        64, // Source Window
        0,
        0,
        256,
        256 // Destination
      );
    }
  }, [epoch, metrics]);

  if (!metrics)
    return <div className="p-6 text-center font-mono text-gray-500">Loading telemetry...</div>;

  return (
    <div className="not-prose my-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Training Dynamics & Grokking</h3>
          <p className="mt-1 font-mono text-sm text-gray-500">
            Reconstruction Loss: {metrics.recon_loss[epoch].toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <span className="block font-mono text-xs text-gray-400">EPOCH</span>
          <span className="font-mono text-2xl font-bold text-blue-600">{epoch}</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col md:col-span-2">
          <canvas
            ref={chartCanvasRef}
            width={500}
            height={256}
            className="h-[256px] w-full rounded border border-gray-300 bg-slate-50"
          />

          {/* SLIDER */}
          <input
            type="range"
            min={0}
            max={metrics.epochs - 1}
            value={epoch}
            onChange={(e) => setEpoch(parseInt(e.target.value))}
            className="mt-4 w-full cursor-pointer accent-blue-600"
          />
          <span className="mt-2 text-center text-xs text-gray-400">
            Scrub to explore optimization landscape
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center">
            <span className="mb-1 text-xs font-bold text-gray-400">TARGET</span>
            <canvas
              ref={origCanvasRef}
              width={256}
              height={256}
              className="h-32 w-32 rounded border border-gray-300 bg-white"
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-xs font-bold text-blue-500">RECONSTRUCTION</span>
            <canvas
              ref={reconCanvasRef}
              width={256}
              height={256}
              className="h-32 w-32 rounded border border-gray-300 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
