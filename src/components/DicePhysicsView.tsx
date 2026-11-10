import React, { useEffect, useRef, useState } from 'react';
import { Die } from '../types/game';
import { tavlaAudio } from '../utils/audio';

interface DicePhysicsProps {
  dice: Die[];
  isRolling: boolean;
  rollSequence?: number;
  canRoll: boolean;
  onRollClick: () => void;
  className?: string;
}

interface PhysicsDieState {
  x: number;          // relative offset px from slot center
  y: number;          // relative offset px from slot center
  vx: number;         // velocity X
  vy: number;         // velocity Y
  z: number;          // height off table (simulate toss arc)
  vz: number;         // vertical velocity
  rotX: number;       // 3D rotation degrees X
  rotY: number;       // 3D rotation degrees Y
  rotZ: number;       // 2D spin degrees Z
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  displayValue: number;
  settled: boolean;
}

// 3D face rotations for standard d6
// Front: 1, Back: 6, Right: 3, Left: 4, Top: 2, Bottom: 5
const FACE_ROTATIONS: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 180, ry: 0 },
};

// Keep the two physical dice from intersecting. The collision is resolved in
// the table plane, so dice bounce apart instead of visually stacking.
const resolveDiceCollision = (states: PhysicsDieState[], bounce: boolean): PhysicsDieState[] => {
  if (states.length < 2) return states;
  const next = states.map((state) => ({ ...state }));
  const a = next[0];
  const b = next[1];
  const minDistance = 40; // 32px dice plus a small visible gap
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distance = Math.hypot(dx, dy);
  if (distance >= minDistance) return states;
  if (distance < 0.001) {
    dx = 1;
    dy = 0;
    distance = 1;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  // Split the correction evenly so neither die is privileged.
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  if (bounce) {
    const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeNormalSpeed < 0) {
      const impulse = -(1 + 0.58) * relativeNormalSpeed * 0.5;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
      // Keep the collision physical, but do not inject a fresh spin near the stop.
    }
  }
  return next;
};

export const DicePhysicsView: React.FC<DicePhysicsProps> = ({
  dice,
  isRolling,
  rollSequence = 0,
  canRoll,
  onRollClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // Blocks any queued physics tick from running after the final settle phase begins.
  const settlingRef = useRef(false);

  // Dynamic physics states for the two visible physical dice
  const [physicsStates, setPhysicsStates] = useState<PhysicsDieState[]>([]);
  const physicsStatesRef = useRef<PhysicsDieState[]>([]);
  const diceRef = useRef(dice);
  physicsStatesRef.current = physicsStates;
  diceRef.current = dice;

  // Sound throttles for impact sounds during roll
  const lastImpactSoundRef = useRef<number>(0);

  // Render pips for a face
  const renderFacePips = (val: number) => {
    const pipPositions: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activePips = pipPositions[val] || [4];

    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-0.5 gap-0.5 pointer-events-none">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activePips.includes(i) && (
              <div
                className={`w-2 h-2 rounded-full ${
                  val === 1
                    ? 'bg-[#171411] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.8),0_0.5px_1px_rgba(255,255,255,0.4)]'
                    : 'bg-[#18181b] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.8),0_0.5px_1px_rgba(255,255,255,0.4)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Trigger physics impulse when isRolling starts
  useEffect(() => {
    if (isRolling) {
      settlingRef.current = false;
      // Backgammon uses two physical dice; doubles grant four moves, not four visible dice.
      // Opening roll passes one die; every regular turn must animate both dice,
      // even though the result values arrive only after the roll animation.
      const count = diceRef.current.length === 1 ? 1 : 2;
      const newStates: PhysicsDieState[] = [];

      for (let i = 0; i < count; i++) {
        // Dynamic impact force: randomized throw impulse with realistic variation
        const angle = (Math.random() * Math.PI) - Math.PI / 2; // throw direction
        const speed = 240 + Math.random() * 180; // throw speed
        const tossHeight = 70 + Math.random() * 50; // arc height

        newStates.push({
          x: (count === 1 ? 0 : (i === 0 ? -32 : 32)) + (Math.random() * 16 - 8),
          y: -110 - Math.random() * 30, // start high up as if tossed from cup/hand
          vx: Math.cos(angle) * speed * (i === 0 ? -0.8 : 0.8),
          vy: 180 + Math.random() * 120,
          z: tossHeight,
          vz: -100 - Math.random() * 80,
          rotX: Math.random() * 720 - 360,
          rotY: Math.random() * 720 - 360,
          rotZ: Math.random() * 360,
          vRotX: (Math.random() > 0.5 ? 1 : -1) * (1800 + Math.random() * 1600),
          vRotY: (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 700),
          vRotZ: (Math.random() > 0.5 ? 1 : -1) * (700 + Math.random() * 500),
          displayValue: Math.floor(Math.random() * 6) + 1,
          settled: false,
        });
      }

      setPhysicsStates(newStates);
      lastTimeRef.current = performance.now();
    }
  }, [isRolling, rollSequence]);

  // Stop immediately on the result face. Do not run a second rotation after the dice land.
  useEffect(() => {
    if (isRolling) return;

    // Freeze the physics simulation before locking the final result.
    settlingRef.current = true;
    const current = physicsStatesRef.current;
    const resultDice = diceRef.current;
    // Backgammon doubles provide four playable die values, but they are still
    // represented by two physical dice. Keep the visual dice count fixed at two.
    const visibleDice = resultDice.slice(0, Math.min(resultDice.length, 2));
    if (visibleDice.length === 0) return;

    // When dice are handed in from the opening roll, this view mounts already
    // holding their results. Seed a settled 3D pose so they appear immediately.
    if (current.length !== visibleDice.length) {
      setPhysicsStates(visibleDice.map((die, i) => {
        const target = FACE_ROTATIONS[die.value] || { rx: 0, ry: 0 };
        return {
          x: (i - (visibleDice.length - 1) / 2) * 34,
          y: 0,
          vx: 0,
          vy: 0,
          z: 0,
          vz: 0,
          rotX: target.rx,
          rotY: target.ry,
          rotZ: 0,
          vRotX: 0,
          vRotY: 0,
          vRotZ: 0,
          displayValue: die.value,
          settled: true,
        };
      }));
      return;
    }

    setPhysicsStates(current.map((state, i) => {
      const value = resultDice[i]?.value || 1;
      const target = FACE_ROTATIONS[value] || { rx: 0, ry: 0 };
      return {
        ...state,
        z: 0,
        rotX: target.rx,
        rotY: target.ry,
        rotZ: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        vRotX: 0,
        vRotY: 0,
        vRotZ: 0,
        displayValue: value,
        settled: true,
      };
    }));
  }, [isRolling, dice.length]);

  // RequestAnimationFrame physics simulation loop
  useEffect(() => {
    if (!isRolling) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const step = (time: number) => {
      const dt = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.05);
      lastTimeRef.current = time;

      setPhysicsStates((prev) => {
        if (settlingRef.current) return prev;
        let changed = false;
        const next = prev.map((die, idx) => {
          if (die.settled) return die;
          changed = true;

          let {
            x,
            y,
            vx,
            vy,
            z,
            vz,
            rotX,
            rotY,
            rotZ,
            vRotX,
            vRotY,
            vRotZ,
            displayValue,
          } = die;

          // Apply gravity
          const gravity = 850; // px/s^2
          vz -= gravity * dt;
          z += vz * dt;

          // Velocity and damping
          x += vx * dt;
          y += vy * dt;
          vx *= Math.pow(0.85, dt * 10);
          vy *= Math.pow(0.85, dt * 10);

          // 3D Rotations
          rotX += vRotX * dt;
          rotY += vRotY * dt;
          rotZ += vRotZ * dt;
          vRotX *= Math.pow(0.8, dt * 10);
          vRotY *= Math.pow(0.8, dt * 10);
          vRotZ *= Math.pow(0.85, dt * 10);

          // Rapid tumbling display changes while in the air
          if (Math.abs(vRotX) + Math.abs(vRotY) > 200) {
            if (Math.random() < 0.25) {
              displayValue = Math.floor(Math.random() * 6) + 1;
            }
          }

          // Table Collision Boundary (z = 0)
          if (z <= 0) {
            z = 0;
            // Impact restitution based on force:
            const impactForce = Math.abs(vz);
            if (impactForce > 40) {
              // Bounce
              vz = -vz * 0.45; // 45% bounce energy retention
              vx += (Math.random() - 0.5) * 80;
              vy += (Math.random() - 0.5) * 80;

              // Play impact sound proportional to velocity (throttle to avoid audio spam)
              const now = performance.now();
              if (now - lastImpactSoundRef.current > 75 && impactForce > 90) {
                lastImpactSoundRef.current = now;
                tavlaAudio.playDiceDrop();
              }
            } else {
              // Rest
              vz = 0;
              z = 0;
            }
          }

          // Table border bounds (keep dice inside central playing area)
          // Keep the dice within the visible right-side tray while allowing natural scatter.
          const maxX = 48;
          const maxY = 30;
          if (x < -maxX) {
            x = -maxX;
            vx = -vx * 0.5;
          } else if (x > maxX) {
            x = maxX;
            vx = -vx * 0.5;
          }
          if (y < -maxY) {
            y = -maxY;
            vy = -vy * 0.5;
          } else if (y > maxY) {
            y = maxY;
            vy = -vy * 0.5;
          }

          return {
            x,
            y,
            vx,
            vy,
            z,
            vz,
            rotX,
            rotY,
            rotZ,
            vRotX,
            vRotY,
            vRotZ,
            displayValue,
            settled: false,
          };
        });

        // Resolve contact after integrating both dice for this frame.
        // This creates a real bounce and prevents either die passing through the other.
        return resolveDiceCollision(next, true);
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRolling, rollSequence]);

  // Dice face renderer for 3D cube representation
  const render3DCube = (
    value: number,
    isUsed: boolean,
    rotX: number,
    rotY: number,
    rotZ: number,
    zHeight: number
  ) => {
    const size = 32; // Compact but more legible 3D dice
    const half = size / 2;

    // Shadow calculation based on height off the board (zHeight)
    const shadowScale = Math.max(0.6, 1 - zHeight / 250);
    const shadowOpacity = Math.max(0.2, 0.65 - zHeight / 300);
    const shadowBlur = 6 + zHeight * 0.25;
    const shadowOffset = 4 + zHeight * 0.35;

    return (
      <div className="relative select-none pointer-events-none" style={{ width: size, height: size }}>
        {/* Physical Drop Shadow onto Wooden Board */}
        <div
          className="absolute rounded-lg bg-black pointer-events-none transition-transform"
          style={{
            width: size * 0.95,
            height: size * 0.95,
            left: size * 0.025,
            top: size * 0.025 + shadowOffset,
            transform: `scale(${shadowScale}) rotate(${rotZ * 0.5}deg)`,
            opacity: shadowOpacity,
            filter: `blur(${shadowBlur}px)`,
          }}
        />

        {/* 3D Cube Container */}
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(${zHeight}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
          }}
        >
          {/* Front Face (1) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fffdf4] via-[#f1e5c9] to-[#c4ad84] border border-[#fff4dc] shadow-[inset_0_2px_3px_rgba(255,255,255,0.98),inset_0_-3px_5px_rgba(15,23,42,0.2),0_1px_2px_rgba(15,23,42,0.16)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `translateZ(${half}px)` }}
          >
            {renderFacePips(1)}
          </div>

          {/* Back Face (6) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fff9e9] via-[#e9dcc0] to-[#bda77f] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
          >
            {renderFacePips(6)}
          </div>

          {/* Right Face (3) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fffaf0] via-[#eadfc9] to-[#c4ad87] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.2)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(3)}
          </div>

          {/* Left Face (4) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fff9e9] via-[#e9dcc0] to-[#bda77f] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(4)}
          </div>

          {/* Top Face (2) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white via-[#f1f5f9] to-[#cbd5e1] border border-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.98),inset_0_-3px_5px_rgba(15,23,42,0.2)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(2)}
          </div>

          {/* Bottom Face (5) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#e9dcc1] via-[#d5c29f] to-[#a68d66] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.92),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(5)}
          </div>
        </div>

        {/* Used diagonal check indicator badge */}
        {isUsed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-6 h-1 bg-red-600/80 rounded rotate-45 shadow" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      data-dice-rolling={isRolling ? 'true' : 'false'}
      data-roll-sequence={rollSequence}
      data-physics-dice-count={physicsStates.length}
      className={`relative flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-xl ${className}`}
      style={{ perspective: '800px' }}
    >
      <style>{`
        @keyframes tavla-dice-roll-fallback {
          0% { transform: translate3d(0, -24px, 0) rotate(-22deg) scale(0.84); }
          32% { transform: translate3d(0, 14px, 0) rotate(105deg) scale(1.12); }
          68% { transform: translate3d(0, -8px, 0) rotate(238deg) scale(0.96); }
          100% { transform: translate3d(0, 0, 0) rotate(360deg) scale(1); }
        }
        .tavla-dice-roll-fallback {
          transform-style: preserve-3d;
          animation: tavla-dice-roll-fallback 620ms cubic-bezier(0.2, 0.75, 0.25, 1) infinite;
          will-change: transform;
        }
        .tavla-dice-roll-fallback-1 { animation-delay: -170ms; }
      `}</style>
      {/* 1. If no dice rolled yet and player can roll: prominent CTA */}
      {dice.length === 0 && !isRolling ? (
        canRoll && (
          <button
            onClick={onRollClick}
            className="pointer-events-auto group relative px-6 py-3 rounded-2xl font-black text-sm tracking-wider uppercase bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 text-amber-50 shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.4)] border-2 border-amber-400/70 hover:from-amber-400 hover:to-amber-700 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer animate-pulse"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>ZAR AT</span>
          </button>
        )
      ) : (
        /* 2. Active or Rolling Dice with 3D Physics */
        <div
          onClick={canRoll && !isRolling ? onRollClick : undefined}
          className={`relative min-w-[130px] min-h-[70px] flex items-center justify-center ${
            canRoll && !isRolling
              ? 'pointer-events-auto cursor-pointer group hover:scale-105 active:scale-95'
              : ''
          }`}
        >
          {/* Keep one identical stage and the same two physical dice before, during and after the roll. */}
          <div className="relative w-36 h-24 overflow-hidden">
            {physicsStates.map((st, i) => {
              const die = dice[i];
              const targetValue = die?.value ?? st.displayValue;
              const targetRot = FACE_ROTATIONS[targetValue] || { rx: 0, ry: 0 };
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate3d(${st.x}px, ${st.y}px, 0) translate(-50%, -50%)`,
                  }}
                >
                  <div className={isRolling ? `tavla-dice-roll-fallback tavla-dice-roll-fallback-${i}` : undefined}>
                    {render3DCube(
                      isRolling ? st.displayValue : targetValue,
                      isRolling ? false : (die?.used ?? false),
                      st.rotX,
                      st.rotY,
                      st.rotZ,
                      st.z
                    )}
                  </div>
                </div>
              );
            })}
            {!isRolling && canRoll && (
              <button
                onClick={onRollClick}
                className="pointer-events-auto absolute -right-14 top-1/2 -translate-y-1/2 ml-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-100 text-xs font-bold border border-amber-500/50 shadow cursor-pointer transition-colors"
              >
                Yeniden
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
