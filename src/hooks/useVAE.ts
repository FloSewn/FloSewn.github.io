import * as ort from 'onnxruntime-web';
import { useCallback, useEffect, useState } from 'react';

// 1. Zwingt ONNX dazu, die WebAssembly-Dateien über ein CDN zu laden,
// um die MIME-Type-Fehler von Vite in Codespaces zu umgehen.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

// 2. Deaktiviert WebAssembly-Threading, um den spezifischen Fehler mit
// der Datei 'ort-wasm-simd-threaded.jsep.mjs' zu verhindern.
ort.env.wasm.numThreads = 1;

export function useVAE() {
  const [encoder, setEncoder] = useState<ort.InferenceSession | null>(null);
  const [decoder, setDecoder] = useState<ort.InferenceSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initModels = async () => {
      try {
        const basePath = import.meta.env.BASE_URL;
        const encSession = await ort.InferenceSession.create(`${basePath}vae_mnist/encoder.onnx`);
        const decSession = await ort.InferenceSession.create(`${basePath}vae_mnist/decoder.onnx`);

        setEncoder(encSession);
        setDecoder(decSession);
        setIsReady(true);
      } catch (err) {
        console.error('Failed to load ONNX models.', err);
      }
    };
    initModels();
  }, []);

  const encode = useCallback(
    async (pixels: Float32Array): Promise<[number, number]> => {
      if (!encoder) return [0, 0];
      const inputTensor = new ort.Tensor('float32', pixels, [1, 784]);
      const results = await encoder.run({ image: inputTensor });
      const mu = results.mu.data as Float32Array;
      return [mu[0], mu[1]];
    },
    [encoder]
  );

  const decode = useCallback(
    async (z1: number, z2: number): Promise<Float32Array> => {
      if (!decoder) return new Float32Array(784);
      const zArray = new Float32Array([z1, z2]);
      const inputTensor = new ort.Tensor('float32', zArray, [1, 2]);
      const results = await decoder.run({ z: inputTensor });
      return results.generated_image.data as Float32Array;
    },
    [decoder]
  );

  return { isReady, encode, decode };
}
