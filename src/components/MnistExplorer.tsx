import React, { useEffect, useRef, useState } from 'react';
import { useVAE } from '../hooks/useVAE';

export default function MnistExplorer() {
  const { isReady, encode, decode } = useVAE();
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [z, setZ] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!isReady) return;
    const generateImage = async () => {
      const pixels = await decode(z[0], z[1]);
      renderToCanvas(pixels, outCanvasRef.current!);
    };
    generateImage();
  }, [z, isReady, decode]);

  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = async () => {
    setIsDrawing(false);
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();

    const pixels = extract28x28Pixels(drawCanvasRef.current!);
    const newZ = await encode(pixels);
    setZ(newZ);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !drawCanvasRef.current) return;
    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = drawCanvasRef.current.getBoundingClientRect();
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const clearCanvas = () => {
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 280, 280);
    }
    setZ([0, 0]);
  };

  useEffect(() => clearCanvas(), []);

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-lg sm:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">Interactive Latent Space (MNIST)</h2>
        <p className="text-sm text-slate-400">
          {isReady
            ? 'Zeichne eine Ziffer, um sie zu enkodieren, oder nutze die Slider.'
            : 'Lade ONNX WebAssembly...'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex flex-col items-center">
          <h3 className="mb-4 font-mono text-xs font-bold tracking-wider text-blue-500">
            ENCODER INPUT
          </h3>
          <canvas
            ref={drawCanvasRef}
            width={280}
            height={280}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={draw}
            className="max w-full cursor-crosshair rounded-lg border-2 border-slate-700 shadow-inner"
          />
          <button
            onClick={clearCanvas}
            className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-xs transition-colors hover:bg-slate-700"
          >
            Clear Canvas
          </button>
        </div>

        <div className="flex flex-col items-center">
          <h3 className="mb-4 font-mono text-xs font-bold tracking-wider text-teal-400">
            DECODER OUTPUT
          </h3>
          <canvas
            ref={outCanvasRef}
            width={280}
            height={280}
            className="max w-full rounded-lg border-2 border-slate-700 bg-black shadow-inner"
          />

          <div className="max mt-6 w-full space-y-4">
            <div>
              <label className="mb-1 flex justify-between font-mono text-xs text-slate-400">
                <span>Z1 (Latent X)</span> <span>{z[0].toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={z[0]}
                onChange={(e) => setZ([parseFloat(e.target.value), z[1]])}
                className="w-full accent-blue-600"
              />
            </div>
            <div>
              <label className="mb-1 flex justify-between font-mono text-xs text-slate-400">
                <span>Z2 (Latent Y)</span> <span>{z[1].toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={z[1]}
                onChange={(e) => setZ([z[0], parseFloat(e.target.value)])}
                className="w-full accent-teal-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Utilities ---
function extract28x28Pixels(sourceCanvas: HTMLCanvasElement): Float32Array {
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 28;
  hiddenCanvas.height = 28;
  const ctx = hiddenCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0, 28, 28);

  const imgData = ctx.getImageData(0, 0, 28, 28).data;
  const pixels = new Float32Array(784);
  for (let i = 0; i < 784; i++) {
    pixels[i] = imgData[i * 4] / 255.0;
  }
  return pixels;
}

function renderToCanvas(pixels: Float32Array, targetCanvas: HTMLCanvasElement) {
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 28;
  hiddenCanvas.height = 28;
  const ctx = hiddenCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(28, 28);

  for (let i = 0; i < 784; i++) {
    const val = pixels[i] * 255;
    imgData.data[i * 4] = val;
    imgData.data[i * 4 + 1] = val;
    imgData.data[i * 4 + 2] = val;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const targetCtx = targetCanvas.getContext('2d')!;
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(hiddenCanvas, 0, 0, 280, 280);
}
