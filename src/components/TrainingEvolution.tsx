import { useEffect, useRef, useState } from 'react';

// FIX: Exakt an die Keys in deiner JSON-Datei angepasst (Plural-s)
interface Metrics {
  train_loss: number[];
  val_loss: number[];
  recon_loss: number[];
  kl_loss: number[];
  epochs: number;
}

export default function TrainingEvolution() {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const reconCanvasRef = useRef<HTMLCanvasElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const spriteImgRef = useRef<HTMLImageElement | null>(null);
  const origImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Alle drei Assets auf den neuen Ordner-Pfad anpassen!
    const jsonUrl = '/worldmodel/vae/training_metrics.json';
    const spriteUrl = '/worldmodel/vae/reconstructions_sprite.png';
    const origUrl = '/worldmodel/vae/original_image.png';

    // JSON laden
    fetch(jsonUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
        const contentType = r.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') === -1) {
          throw new Error('Erwartetes JSON, bekam aber HTML. Pfad prüfen!');
        }
        return r.json();
      })
      .then((data) => {
        setMetrics(data);
        setEpoch(0);
      })
      .catch((e) => console.error('FATAL:', e));

    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount === 2) setImagesLoaded(true);
    };

    // Bilder laden UND IN DIE REFS SPEICHERN!
    const sprite = new Image();
    sprite.onload = () => {
      spriteImgRef.current = sprite; // <-- DAS HATTE ICH VERGESSEN
      checkDone();
    };
    sprite.onerror = () => console.error(`Sprite nicht gefunden unter: ${spriteUrl}`);
    sprite.src = spriteUrl;

    const orig = new Image();
    orig.onload = () => {
      origImgRef.current = orig; // <-- UND DAS HIER AUCH
      checkDone();
    };
    orig.onerror = () => console.error(`Original nicht gefunden unter: ${origUrl}`);
    orig.src = origUrl;
  }, []);

  useEffect(() => {
    // Nur zeichnen, wenn Daten und Bilder WIRKLICH da sind
    if (!metrics || !imagesLoaded) return;

    // --------------------------------------------------------
    // 1. CHART ZEICHNEN
    // --------------------------------------------------------
    const canvas = chartCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const w = canvas.width;
      const h = canvas.height;
      const padding = 20;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, h - padding);
      ctx.lineTo(w - padding, h - padding);
      ctx.stroke();

      // Saftey-Check bei der Normierung (fängt leere Arrays ab)
      // Klassische lineare Min-Max Normierung
      const normalize = (arr: number[] | undefined) => {
        if (!arr || arr.length === 0) return [];
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        if (max === min) return arr.map(() => 0.5);
        return arr.map((v) => (v - min) / (max - min));
      };

      const plotSpecs = [
        { key: 'recon_loss', color: '#ef4444', data: normalize(metrics.recon_loss) },
        { key: 'kl_loss', color: '#f59e0b', data: normalize(metrics.kl_loss) },
        { key: 'train_loss', color: '#10b981', data: normalize(metrics.train_loss) },
        { key: 'val_loss', color: '#3b82f6', data: normalize(metrics.val_loss) },
      ].filter((spec) => spec.data.length > 0); // Nur rendern, was auch existiert

      const scaleX = (w - 2 * padding) / (metrics.epochs - 1);
      const scaleY = h - 2 * padding;

      const getX = (ep: number) => padding + ep * scaleX;
      const getY = (val: number) => h - padding - val * scaleY;

      plotSpecs.forEach((spec) => {
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(spec.data[0]));
        for (let i = 1; i < metrics.epochs; i++) {
          ctx.lineTo(getX(i), getY(spec.data[i]));
        }
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = spec.key === 'recon_loss' ? 3 : 1.5;
        ctx.stroke();
      });

      const currX = getX(epoch);
      ctx.beginPath();
      ctx.moveTo(currX, padding);
      ctx.lineTo(currX, h - padding);
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      plotSpecs.forEach((spec) => {
        ctx.beginPath();
        ctx.arc(currX, getY(spec.data[epoch]), 4, 0, 2 * Math.PI);
        ctx.fillStyle = spec.color;
        ctx.fill();
      });
    }

    // --------------------------------------------------------
    // 2. BILDER ZEICHNEN
    // --------------------------------------------------------
    const oCtx = origCanvasRef.current?.getContext('2d');
    if (oCtx && origImgRef.current) {
      oCtx.imageSmoothingEnabled = false;
      oCtx.drawImage(origImgRef.current, 0, 0, 256, 256);
    }

    const rCtx = reconCanvasRef.current?.getContext('2d');
    if (rCtx && spriteImgRef.current) {
      rCtx.imageSmoothingEnabled = false;
      rCtx.clearRect(0, 0, 256, 256);
      rCtx.drawImage(spriteImgRef.current, epoch * 64, 0, 64, 64, 0, 0, 256, 256);
    }
  }, [epoch, metrics, imagesLoaded]);

  if (!metrics || !imagesLoaded) {
    return (
      <div className="my-10 p-6 text-center font-mono text-gray-500">
        Initializing Telemetry & Assets...
      </div>
    );
  }

  return (
    <div className="not-prose my-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Training Dynamics (Normalized [0, 1])</h3>
          <p className="mt-1 font-mono text-sm text-gray-500">
            Recon Loss (Raw): {metrics.recon_loss[epoch].toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <span className="block font-mono text-xs text-gray-400">EPOCH</span>
          <span className="font-mono text-2xl font-bold text-blue-600">{epoch}</span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col md:col-span-2">
          <canvas
            ref={chartCanvasRef}
            width={500}
            height={256}
            className="h-[256px] w-full rounded border border-gray-300 bg-slate-50"
          />

          <input
            type="range"
            min={0}
            max={metrics.epochs - 1}
            value={epoch}
            onChange={(e) => setEpoch(parseInt(e.target.value, 10))}
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

      {/* Legende */}
      <div className="mt-2 flex flex-wrap justify-center gap-4 border-t pt-4">
        {[
          { label: 'Recon Loss', color: '#ef4444' },
          { label: 'KL Loss', color: '#f59e0b' },
          { label: 'Train Loss', color: '#10b981' },
          { label: 'Val Loss', color: '#3b82f6' },
        ].map((item) => (
          <div key={item.label} className="flex items-center font-mono text-xs text-gray-600">
            <span
              className="mr-2 h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            ></span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
