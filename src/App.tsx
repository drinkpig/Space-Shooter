import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw } from 'lucide-react';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_SPEED = 6;
const BULLET_SPEED = 10;
const ENEMY_SPEED_MIN = 2;
const ENEMY_SPEED_MAX = 5;
const SPAWN_RATE = 45; // frames

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);

  const requestRef = useRef<number>();
  const playerRef = useRef({ x: CANVAS_WIDTH / 2 - 20, y: CANVAS_HEIGHT - 60, width: 40, height: 40 });
  const bulletsRef = useRef<{x: number, y: number, width: number, height: number}[]>([]);
  const enemiesRef = useRef<{x: number, y: number, width: number, height: number, speed: number, hp: number, maxHp: number}[]>([]);
  const particlesRef = useRef<{x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string, size: number}[]>([]);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);
  const frameCountRef = useRef(0);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    for (let i = 0; i < 70; i++) {
      starsRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 3 + 0.5
      });
    }
  }, []);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color,
        size: Math.random() * 3 + 1
      });
    }
  }, []);

  const initGame = useCallback(() => {
    playerRef.current = { x: CANVAS_WIDTH / 2 - 20, y: CANVAS_HEIGHT - 60, width: 40, height: 40 };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    frameCountRef.current = 0;
    setScore(0);
  }, []);

  const startGame = useCallback(() => {
    initGame();
    setGameState('PLAYING');
  }, [initGame]);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw stars (always moving, even in menu)
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(star => {
      star.y += star.speed;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
      ctx.globalAlpha = star.size / 3;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    if (gameState === 'PLAYING') {
      // Input
      if (keysRef.current['ArrowLeft']) {
        playerRef.current.x -= PLAYER_SPEED;
      }
      if (keysRef.current['ArrowRight']) {
        playerRef.current.x += PLAYER_SPEED;
      }

      // Bounds
      if (playerRef.current.x < 0) playerRef.current.x = 0;
      if (playerRef.current.x + playerRef.current.width > CANVAS_WIDTH) {
        playerRef.current.x = CANVAS_WIDTH - playerRef.current.width;
      }

      // Shooting
      if (frameCountRef.current % 12 === 0) {
        bulletsRef.current.push({
          x: playerRef.current.x + playerRef.current.width / 2 - 3,
          y: playerRef.current.y,
          width: 6,
          height: 18
        });
      }

      // Spawning enemies
      // Difficulty increases over time
      const currentSpawnRate = Math.max(15, SPAWN_RATE - Math.floor(frameCountRef.current / 600));
      if (frameCountRef.current % currentSpawnRate === 0) {
        const size = Math.random() * 25 + 20;
        const isTough = Math.random() > 0.8;
        enemiesRef.current.push({
          x: Math.random() * (CANVAS_WIDTH - size),
          y: -size,
          width: size,
          height: size,
          speed: Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN + (frameCountRef.current / 2000),
          hp: isTough ? 3 : 1,
          maxHp: isTough ? 3 : 1
        });
      }

      // Update bullets
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const b = bulletsRef.current[i];
        b.y -= BULLET_SPEED;
        if (b.y + b.height < 0) {
          bulletsRef.current.splice(i, 1);
        }
      }

      // Update enemies
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const e = enemiesRef.current[i];
        e.y += e.speed;
        if (e.y > CANVAS_HEIGHT) {
          enemiesRef.current.splice(i, 1);
        }
      }

      // Collisions
      // Bullet hits enemy
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const e = enemiesRef.current[i];
        for (let j = bulletsRef.current.length - 1; j >= 0; j--) {
          const b = bulletsRef.current[j];
          if (
            b.x < e.x + e.width &&
            b.x + b.width > e.x &&
            b.y < e.y + e.height &&
            b.y + b.height > e.y
          ) {
            // Hit
            bulletsRef.current.splice(j, 1);
            e.hp -= 1;
            
            // Hit particles
            createParticles(b.x + b.width/2, b.y, '#facc15', 3);

            if (e.hp <= 0) {
              enemiesRef.current.splice(i, 1);
              setScore(s => s + (e.maxHp > 1 ? 30 : 10));
              // Explosion particles
              createParticles(e.x + e.width/2, e.y + e.height/2, e.maxHp > 1 ? '#f97316' : '#ef4444', 15);
            }
            break;
          }
        }
      }

      // Player hits enemy
      const p = playerRef.current;
      for (let i = 0; i < enemiesRef.current.length; i++) {
        const e = enemiesRef.current[i];
        // Shrink hitbox slightly for better feel
        const hitboxShrink = 5;
        if (
          p.x + hitboxShrink < e.x + e.width - hitboxShrink &&
          p.x + p.width - hitboxShrink > e.x + hitboxShrink &&
          p.y + hitboxShrink < e.y + e.height - hitboxShrink &&
          p.y + p.height - hitboxShrink > e.y + hitboxShrink
        ) {
          // Game Over
          createParticles(p.x + p.width/2, p.y + p.height/2, '#3b82f6', 40);
          setGameState('GAME_OVER');
        }
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }

      // Draw
      // Player (Spaceship shape)
      ctx.fillStyle = '#3b82f6'; // blue-500
      ctx.beginPath();
      ctx.moveTo(p.x + p.width / 2, p.y);
      ctx.lineTo(p.x + p.width, p.y + p.height);
      ctx.lineTo(p.x + p.width / 2, p.y + p.height - 10);
      ctx.lineTo(p.x, p.y + p.height);
      ctx.closePath();
      ctx.fill();
      
      // Engine flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(p.x + p.width / 2 - 5, p.y + p.height - 8);
      ctx.lineTo(p.x + p.width / 2 + 5, p.y + p.height - 8);
      ctx.lineTo(p.x + p.width / 2, p.y + p.height + (Math.random() * 10 + 5));
      ctx.closePath();
      ctx.fill();

      // Bullets
      ctx.fillStyle = '#facc15'; // yellow-400
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#facc15';
      bulletsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 3);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Enemies
      enemiesRef.current.forEach(e => {
        ctx.fillStyle = e.maxHp > 1 ? '#ea580c' : '#ef4444'; // orange-600 : red-500
        
        // Draw enemy ship
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.width, e.y);
        ctx.lineTo(e.x + e.width / 2, e.y + e.height);
        ctx.closePath();
        ctx.fill();
        
        // Damage indicator
        if (e.hp < e.maxHp) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();
        }
      });

      // Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      frameCountRef.current++;
    }

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, createParticles]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Only track if mouse is down or it's a touch event
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    
    playerRef.current.x = x - playerRef.current.width / 2;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans select-none">
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)] border border-slate-800">
        
        {/* Score Display */}
        <div className="absolute top-4 left-4 z-10 text-white font-mono text-xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          SCORE: {score}
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block w-full max-w-[400px] h-auto aspect-[2/3] touch-none cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
        />

        {/* Overlays */}
        {gameState === 'MENU' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 mb-2 tracking-widest text-center">
              SPACE<br/>SHOOTER
            </h1>
            <p className="text-slate-400 mb-8 font-mono text-sm">Use Arrows or Drag to move</p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              <Play size={24} fill="currentColor" />
              START GAME
            </button>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <h2 className="text-5xl font-black text-red-500 mb-2 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              GAME OVER
            </h2>
            <p className="text-slate-300 text-2xl mb-8 font-mono">SCORE: {score}</p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 hover:bg-slate-200 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              <RotateCcw size={24} />
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
