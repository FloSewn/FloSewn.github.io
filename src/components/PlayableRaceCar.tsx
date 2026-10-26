import { useEffect, useRef, useState } from 'react';

export default function PlayableRaceCar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI States für Score und Game Over
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Wir speichern die Physik im Ref, damit der Game-Loop nicht durch React-Renders unterbrochen wird
  const physics = useRef({
    x: 32.0,
    y: 12.0, // 32 - 20 (Center - Radius)
    theta: 0.0,
    velocity: 0.0,
    score: 0.0,
    isGameOver: false,
  });

  const keys = useRef<{ [key: string]: boolean }>({});

  // Konstanten aus deinem Python-Code
  const TRACK_CENTER = { x: 32.0, y: 32.0 };
  const TRACK_RADIUS = 20.0;
  const SCALE = 5; // Skaliert das 64x64 Grid auf 320x320 für den Browser

  const resetGame = () => {
    // Startet das Auto oben auf dem Kreis, nach rechts gerichtet
    physics.current = {
      x: TRACK_CENTER.x,
      y: TRACK_CENTER.y - TRACK_RADIUS,
      theta: 0.0,
      velocity: 0.0,
      score: 0.0,
      isGameOver: false,
    };
    setGameOver(false);
    setScore(0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };

    // Verhindert das Scrollen der Seite mit den Pfeiltasten, während man spielt
    const preventScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const gameLoop = () => {
      if (!physics.current.isGameOver) {
        // --- NEU: Zeit-Skalierung für 60 FPS Browser-Rendering ---
        const TIME_SCALE = 0.15;

        // 1. Aktionen auslesen
        let steer = 0.0;
        let accel = 0.0;

        if (keys.current['ArrowUp'] || keys.current['w']) accel = 1.0;
        if (keys.current['ArrowDown'] || keys.current['s']) accel = -1.0;
        if (keys.current['ArrowLeft'] || keys.current['a']) steer = -1.0;
        if (keys.current['ArrowRight'] || keys.current['d']) steer = 1.0;

        // 2. Physik updaten (Sanftere Beschleunigung für den Browser)
        const friction = 0.95;
        const max_speed = 10.0; // Wir können jetzt wieder deine originalen 10.0 erlauben!

        // Beschleunigung durch TIME_SCALE dämpfen
        let vel = physics.current.velocity * friction + accel * TIME_SCALE * 2.0;
        vel = Math.max(Math.min(vel, max_speed), -max_speed);

        // Lenkung: Ein bisschen wendiger machen (* 2.5), aber durch TIME_SCALE dämpfen
        const theta = physics.current.theta + steer * (vel * 0.1 * TIME_SCALE * 2.5);

        // Position: Die tatsächliche Bewegung auf dem Bildschirm drosseln
        const x = physics.current.x + vel * Math.cos(theta) * TIME_SCALE;
        const y = physics.current.y + vel * Math.sin(theta) * TIME_SCALE;

        // 3. Reward & Abbruch berechnen (exakt wie in deinem Gym)
        const distToCenter = Math.sqrt((x - TRACK_CENTER.x) ** 2 + (y - TRACK_CENTER.y) ** 2);
        const error = Math.abs(distToCenter - TRACK_RADIUS);

        // Reward skaliert mit der Zeit, damit der Score nicht in 2 Sekunden explodiert
        let stepReward = (vel * 0.5 - error * 0.2 - 0.1) * TIME_SCALE;

        if (error > 5.0) {
          physics.current.isGameOver = true;
          stepReward -= 100.0;
          setGameOver(true);
        }

        // State updaten
        physics.current.velocity = vel;
        physics.current.theta = theta;
        physics.current.x = x;
        physics.current.y = y;
        physics.current.score += stepReward;

        setScore(Math.floor(physics.current.score));
      }

      // 4. Zeichnen (Rendern) - bleibt exakt gleich!
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.arc(TRACK_CENTER.x * SCALE, TRACK_CENTER.y * SCALE, TRACK_RADIUS * SCALE, 0, 2 * Math.PI);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 5 * SCALE;
      ctx.stroke();

      ctx.save();
      ctx.translate(physics.current.x * SCALE, physics.current.y * SCALE);
      ctx.rotate(physics.current.theta);

      ctx.fillStyle = '#ff0000';
      const carLength = 4.0 * SCALE;
      const carWidth = 2.0 * SCALE;
      ctx.fillRect(-carLength / 2, -carWidth / 2, carLength, carWidth);
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="not-prose my-10 flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex w-full max-w-[320px] items-center justify-between font-mono">
        <span className="font-bold text-gray-700">Score: {score}</span>
        {gameOver && <span className="animate-pulse font-bold text-red-600">OUT OF BOUNDS!</span>}
      </div>

      <canvas
        ref={canvasRef}
        width={320} // 64 * 5
        height={320}
        className={`rounded border-2 bg-white ${gameOver ? 'border-red-500' : 'border-gray-800'}`}
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="text-center font-mono text-xs text-gray-500">
          Controls: [W] [A] [S] [D] or Arrow Keys
        </div>

        {gameOver && (
          <button
            onClick={resetGame}
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
          >
            Restart Engine
          </button>
        )}
      </div>
    </div>
  );
}
