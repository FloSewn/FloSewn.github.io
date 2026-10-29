import * as ort from 'onnxruntime-web';
import { useEffect, useRef, useState } from 'react';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.wasm.numThreads = 1;

// Typisierung für die PCA-Daten, die wir jetzt live laden
interface PCAData {
  mean: number[];
  components: number[][];
}

export default function VaePipeline() {
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const latentCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvas = useRef(document.createElement('canvas'));

  // Wir speichern jetzt enc, dec UND pca gemeinsam im State
  const [models, setModels] = useState<{
    enc: ort.InferenceSession;
    dec: ort.InferenceSession;
    pca: PCAData;
  } | null>(null);

  const [fps, setFps] = useState(0);
  const physics = useRef({ x: 32.0, y: 12.0, theta: 0.0, velocity: 0.0 });
  const keys = useRef<{ [key: string]: boolean }>({});

  // ==========================================
  // NEU: HUGGING FACE DOWNLOAD
  // ==========================================
  useEffect(() => {
    hiddenCanvas.current.width = 64;
    hiddenCanvas.current.height = 64;

    const loadModels = async () => {
      try {
        // Passe "FloSewn" hier ggf. an deinen Hugging Face Namen an
        const baseUrl = 'https://huggingface.co/FloSewn/worldmodels-racecar/resolve/main';

        // Promise.all lädt alle drei Dateien extrem schnell parallel herunter
        const [enc, dec, pcaResponse] = await Promise.all([
          ort.InferenceSession.create(`${baseUrl}/vae_encoder.onnx`),
          ort.InferenceSession.create(`${baseUrl}/vae_decoder.onnx`),
          fetch(`${baseUrl}/pca_params.json`),
        ]);

        const pca = await pcaResponse.json();

        setModels({ enc, dec, pca });
        console.log('✅ Modelle und PCA erfolgreich von Hugging Face geladen!');
      } catch (e) {
        console.error('Fehler beim Laden von Hugging Face:', e);
      }
    };
    loadModels();
  }, []);

  // ... Controls bleiben identisch ...
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };

    // Neu: Scroll-Verhinderung beim Fahren einbauen
    const preventScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', preventScroll, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', preventScroll);
    };
  }, []);

  // Game & Inference Loop
  useEffect(() => {
    if (!models) return;
    let isRunning = true;
    let lastTime = performance.now();
    let fpsTimer = performance.now();
    let frames = 0;

    const pcaHistory: { x: number; y: number }[] = [];

    // Exakt 30 FPS (wie im Python-Gym), also ~33.3 Millisekunden pro Schritt
    const FIXED_TIME_STEP = 1000 / 30;

    const loop = async () => {
      if (!isRunning) return;

      const now = performance.now();
      const elapsed = now - lastTime;

      // Wir führen Logik & KI nur aus, wenn mindestens 33.3ms vergangen sind
      if (elapsed >= FIXED_TIME_STEP) {
        // Verhindert Mikroruckler, indem wir den Restwert übernehmen
        lastTime = now - (elapsed % FIXED_TIME_STEP);

        // 1. Physik
        let steer = 0.0,
          accel = 0.0;
        if (keys.current['ArrowUp'] || keys.current['w']) accel = 0.2;
        if (keys.current['ArrowDown'] || keys.current['s']) accel = -0.2;
        if (keys.current['ArrowLeft'] || keys.current['a']) steer = -0.8;
        if (keys.current['ArrowRight'] || keys.current['d']) steer = 0.8;

        let vel = physics.current.velocity * 0.95 + accel;
        vel = Math.max(Math.min(vel, 2.0), -2.0);
        physics.current.theta += steer * (vel * 0.1);

        let nextX = physics.current.x + vel * Math.cos(physics.current.theta);
        let nextY = physics.current.y + vel * Math.sin(physics.current.theta);

        // NEU: Periodische Randbedingungen (Torus-Topologie auf 64x64)
        // Wir addieren 64.0 vor dem Modulo, um negative Werte abzufangen
        physics.current.x = (nextX + 64.0) % 64.0;
        physics.current.y = (nextY + 64.0) % 64.0;

        physics.current.velocity = vel;

        // 2. Zeichnen auf Hidden 64x64
        const hCtx = hiddenCanvas.current.getContext('2d', { willReadFrequently: true })!;
        hCtx.fillStyle = '#ffffff';
        hCtx.fillRect(0, 0, 64, 64);
        hCtx.beginPath();
        hCtx.arc(32, 32, 20, 0, 2 * Math.PI);
        hCtx.strokeStyle = '#555555';
        hCtx.lineWidth = 5;
        hCtx.stroke();

        hCtx.save();
        hCtx.translate(physics.current.x, physics.current.y);
        hCtx.rotate(physics.current.theta);
        hCtx.fillStyle = '#ff0000';
        hCtx.fillRect(-2, -1, 4, 2);
        hCtx.restore();

        // 3. Pixel HWC -> CHW formatieren
        const imgData = hCtx.getImageData(0, 0, 64, 64).data;
        const floatData = new Float32Array(3 * 64 * 64);
        for (let i = 0; i < 64 * 64; i++) {
          floatData[i] = imgData[i * 4] / 255.0;
          floatData[64 * 64 + i] = imgData[i * 4 + 1] / 255.0;
          floatData[2 * 64 * 64 + i] = imgData[i * 4 + 2] / 255.0;
        }

        // 4. INFERENZ: Encoder
        const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 64, 64]);
        const encResult = await models.enc.run({ input_image: inputTensor });
        const mu = encResult.latent_mu.data as Float32Array;
        const logvar = encResult.latent_logvar.data as Float32Array; // Die echte Varianz vom VAE!

        // 5. PCA Projektion
        let pcaX = 0,
          pcaY = 0;
        for (let i = 0; i < 32; i++) {
          const centered = mu[i] - models.pca.mean[i];
          pcaX += centered * models.pca.components[0][i];
          pcaY += centered * models.pca.components[1][i];
        }

        // NEU: Punkt zur Historie hinzufügen und auf die letzten 40 Frames (ca. 1.3 Sekunden) begrenzen
        const plotX = 128 + pcaX * 40.0;
        const plotY = 128 - pcaY * 40.0;
        pcaHistory.push({ x: plotX, y: plotY });
        if (pcaHistory.length > 40) pcaHistory.shift();

        // 6. INFERENZ: Decoder
        const latentTensor = new ort.Tensor('float32', mu, [1, 32]);
        const decResult = await models.dec.run({ latent_z: latentTensor });
        const outPixels = decResult.reconstruction.data as Float32Array;

        // 7. RENDERING Panel 1 (Input)
        const inCtx = inputCanvasRef.current?.getContext('2d');
        if (inCtx) {
          inCtx.imageSmoothingEnabled = false;
          inCtx.drawImage(hiddenCanvas.current, 0, 0, 256, 256);
        }

        // ==========================================
        // 8. RENDERING Panel 2 (PCA Trajektorie + Echter VAE Unsicherheits-Halo)
        // ==========================================
        const latCtx = latentCanvasRef.current?.getContext('2d');
        if (latCtx && models.pca) {
          latCtx.fillStyle = '#f8fafc';
          latCtx.fillRect(0, 0, 256, 256);

          // Achsenkreuz
          latCtx.strokeStyle = '#e2e8f0';
          latCtx.lineWidth = 1;
          latCtx.beginPath();
          latCtx.moveTo(128, 0);
          latCtx.lineTo(128, 256);
          latCtx.stroke();
          latCtx.beginPath();
          latCtx.moveTo(0, 128);
          latCtx.lineTo(256, 128);
          latCtx.stroke();

          // PCA Projektion für mu
          let pcaX = 0,
            pcaY = 0;
          for (let i = 0; i < 32; i++) {
            const centered = mu[i] - models.pca.mean[i];
            pcaX += centered * models.pca.components[0][i];
            pcaY += centered * models.pca.components[1][i];
          }

          const plotX = 128 + pcaX * 40.0;
          const plotY = 128 - pcaY * 40.0;

          pcaHistory.push({ x: plotX, y: plotY });
          if (pcaHistory.length > 40) pcaHistory.shift();

          // Trajektorie-Spur
          if (pcaHistory.length > 1) {
            latCtx.lineWidth = 3;
            for (let i = 1; i < pcaHistory.length; i++) {
              latCtx.beginPath();
              latCtx.moveTo(pcaHistory[i - 1].x, pcaHistory[i - 1].y);
              latCtx.lineTo(pcaHistory[i].x, pcaHistory[i].y);
              const alpha = i / pcaHistory.length;
              latCtx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.6})`;
              latCtx.stroke();
            }
          }

          // ECHTE UNSICHERHEIT BERECHNEN:
          // logvar in Standardabweichung sigma übersetzen: sigma = exp(0.5 * logvar)
          // Wir nehmen den Durchschnitt über alle 32 Dimensionen als Gesamt-Unsicherheitswert
          let avgSigma = 0;
          for (let i = 0; i < 32; i++) {
            avgSigma += Math.exp(0.5 * logvar[i]);
          }
          avgSigma /= 32.0;

          // Skalieren für den Canvas (je größer avgSigma, desto größer der Radius)
          const haloRadius = avgSigma * 300; //Math.max(16, avgSigma * 30.0);

          // 1. Ruhiger, transparenter Unsicherheits-Kreis (kein Pulsieren, rein datengetrieben)
          latCtx.beginPath();
          latCtx.arc(plotX, plotY, haloRadius, 0, Math.PI * 2);
          latCtx.fillStyle = 'rgba(59, 130, 246, 0.12)';
          latCtx.fill();
          latCtx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          latCtx.lineWidth = 1;
          latCtx.stroke();

          // 2. Der stabile Haupt-Kernpunkt
          latCtx.beginPath();
          latCtx.arc(plotX, plotY, 5, 0, 2 * Math.PI);
          latCtx.fillStyle = '#1d4ed8';
          latCtx.fill();
          latCtx.strokeStyle = '#ffffff';
          latCtx.lineWidth = 1.5;
          latCtx.stroke();
        }

        // 9. RENDERING Panel 3 (Reconstruction)
        const outCtx = outputCanvasRef.current?.getContext('2d');
        if (outCtx) {
          const outImg = new ImageData(64, 64);
          for (let i = 0; i < 64 * 64; i++) {
            outImg.data[i * 4] = outPixels[i] * 255;
            outImg.data[i * 4 + 1] = outPixels[64 * 64 + i] * 255;
            outImg.data[i * 4 + 2] = outPixels[2 * 64 * 64 + i] * 255;
            outImg.data[i * 4 + 3] = 255;
          }
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 64;
          tempCanvas.height = 64;
          tempCanvas.getContext('2d')?.putImageData(outImg, 0, 0);

          outCtx.imageSmoothingEnabled = false;
          outCtx.drawImage(tempCanvas, 0, 0, 256, 256);
        }

        // FPS Counter Update
        frames++;
        if (now - fpsTimer >= 1000) {
          setFps(frames);
          frames = 0;
          fpsTimer = now;
        }
      }

      // Wir überlassen dem Browser das Scheduling (requestAnimationFrame statt setTimeout(0)).
      // Das ist extrem ressourcenschonend und verhindert, dass der Tab einfriert.
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);

    // Cleanup: Verhindert Memory Leaks und Endlos-Schleifen beim Komponenten-Wechsel
    return () => {
      isRunning = false;
    };
  }, [models]);

  // ... JSX Return bleibt identisch ...
  return (
    <div className="not-prose my-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between font-mono text-sm text-gray-500">
        <span>Real-time Inference Pipeline</span>
        <span>{models ? `${fps} FPS` : 'Fetching models from Hugging Face...'}</span>
      </div>
      {/* ... Rest der JSX Panels (wie im vorherigen Code-Block) ... */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center">
          <span className="mb-2 text-xs font-bold text-gray-400">RAW OBSERVATION</span>
          <canvas
            ref={inputCanvasRef}
            width={256}
            height={256}
            className="rounded border border-gray-300 bg-white"
          />
          <span className="mt-2 text-xs text-gray-400">[W] [A] [S] [D] to drive</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-col items-center">
            <span className="mb-2 text-xs font-bold text-sky-500">LATENT FLOWER (32D)</span>
            {/* Dunkler Hintergrund (slate-900) bringt den Neon-Glow zur Geltung */}
            <canvas
              ref={latentCanvasRef}
              width={256}
              height={256}
              className="rounded border border-slate-700 bg-slate-900 shadow-inner"
            />
            <span className="mt-2 text-xs text-gray-400">Radius = µ, Puls = Organisch</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="mb-2 text-xs font-bold text-teal-500">VAE RECONSTRUCTION</span>
          <canvas
            ref={outputCanvasRef}
            width={256}
            height={256}
            className="rounded border border-gray-300 bg-white"
          />
          <span className="mt-2 text-xs text-gray-400">Decoded frame</span>
        </div>
      </div>
    </div>
  );
}
