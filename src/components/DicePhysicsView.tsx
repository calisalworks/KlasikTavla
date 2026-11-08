import React, { useEffect, useRef, useState } from 'react';
import { Die } from '../types/game';
import { tavlaAudio } from '../utils/audio';

interface DicePhysicsProps {
  dice: Die[];
  isRolling: boolean;
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
  const minDistance = 36; // 28px dice plus a small visible gap
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
  canRoll,
  onRollClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // Blocks any queued physics tick from running after the final settle phase begins.
  const settlingRef = useRef(false);

  // Dynamic physics states for up to 4 dice
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
                className={`w-1.5 h-1.5 rounded-full ${
                  val === 1
                    ? 'bg-rose-700 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.8),0_0.5px_1px_rgba(255,255,255,0.4)]'
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
      const count = 2;
      const newStates: PhysicsDieState[] = [];

      for (let i = 0; i < count; i++) {
        // Dynamic impact force: randomized throw impulse with realistic variation
        const angle = (Math.random() * Math.PI) - Math.PI / 2; // throw direction
        const speed = 240 + Math.random() * 180; // throw speed
        const tossHeight = 70 + Math.random() * 50; // arc height

        newStates.push({
          x: (i === 0 ? -32 : 32) + (Math.random() * 16 - 8),
          y: -110 - Math.random() * 30, // start high up as if tossed from cup/hand
          vx: Math.cos(angle) * speed * (i === 0 ? -0.8 : 0.8),
          vy: 180 + Math.random() * 120,
          z: tossHeight,
          vz: -100 - Math.random() * 80,
          rotX: Math.random() * 720 - 360,
          rotY: Math.random() * 720 - 360,
          rotZ: Math.random() * 360,
          vRotX: (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 700),
          vRotY: (Math.random() > 0.5 ? 1 : -1) * (600 + Math.random() * 700),
          vRotZ: (Math.random() > 0.5 ? 1 : -1) * (250 + Math.random() * 350),
          displayValue: Math.floor(Math.random() * 6) + 1,
          settled: false,
        });
      }

      setPhysicsStates(newStates);
      lastTimeRef.current = performance.now();
    }
  }, [isRolling]);

  // One short final roll animation, then a hard, stable stop on the result.
  // Depend only on the rolling state so parent renders cannot restart the animation.
  useEffect(() => {
    if (isRolling) return;

    // Freeze the physics simulation before reading the final angles. This also
    // makes any already-queued physics updater a no-op during the settle animation.
    settlingRef.current = true;
    const current = physicsStatesRef.current;
    const resultDice = diceRef.current;
    if (resultDice.length === 0 || current.length === 0) return;

    const startedAt = performance.now();
    const duration = 900;
    const starts = current.map((st, i) => {
      const value = resultDice[i]?.value || 1;
      const target = FACE_ROTATIONS[value] || { rx: 0, ry: 0 };
      const nearest = (from: number, to: number) =>
        from + ((((to - from) % 360) + 540) % 360 - 180);
      return {
        state: st,
        value,
        endX: nearest(st.rotX, target.rx),
        endY: nearest(st.rotY, target.ry),
        endZ: nearest(st.rotZ, 0),
      };
    });

    let frame = 0;
    const finishRoll = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      // Smooth, longer deceleration into the final face without a secondary wobble.
      const eased = 1 - Math.pow(1 - progress, 3);
      setPhysicsStates(starts.map(({ state, value, endX, endY, endZ }) => ({
        ...state,
        x: state.x,
        y: state.y,
        z: 0,
        rotX: state.rotX + (endX - state.rotX) * eased,
        rotY: state.rotY + (endY - state.rotY) * eased,
        rotZ: state.rotZ + (endZ - state.rotZ) * eased,
        vx: 0,
        vy: 0,
        vz: 0,
        vRotX: 0,
        vRotY: 0,
        vRotZ: 0,
        displayValue: value,
        settled: progress >= 1,
      })));

      if (progress < 1) {
        frame = requestAnimationFrame(finishRoll);
      } else {
        // Lock the exact final face and stop all movement.
        setPhysicsStates(starts.map(({ state, value }) => {
          const target = FACE_ROTATIONS[value] || { rx: 0, ry: 0 };
          return {
            ...state,
            z: 0,
            rotX: target.rx,
            rotY: target.ry,
            rotZ: 0,
            vx: 0, vy: 0, vz: 0,
            vRotX: 0, vRotY: 0, vRotZ: 0,
            displayValue: value,
            settled: true,
          };
        }));
      }
    };

    frame = requestAnimationFrame(finishRoll);
    return () => cancelAnimationFrame(frame);
  }, [isRolling]);

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
          const maxX = 52;
          const maxY = 34;
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
  }, [isRolling]);

  // Dice face renderer for 3D cube representation
  const render3DCube = (
    value: number,
    isUsed: boolean,
    rotX: number,
    rotY: number,
    rotZ: number,
    zHeight: number
  ) => {
    const size = 28; // 28px compact dice size
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
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#ffffff] via-[#f7f5f0] to-[#e6e1d6] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `translateZ(${half}px)` }}
          >
            {renderFacePips(1)}
          </div>

          {/* Back Face (6) */}
          <div
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#f8f6f0] via-[#ede9e0] to-[#dfdad0] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
          >
            {renderFacePips(6)}
          </div>

          {/* Right Face (3) */}
          <div
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#fcfbf7] via-[#f2eee4] to-[#e3ded4] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(3)}
          </div>

          {/* Left Face (4) */}
          <div
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#f9f7f2] via-[#eeeae0] to-[#ded9cf] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(4)}
          </div>

          {/* Top Face (2) */}
          <div
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#ffffff] via-[#f5f3ec] to-[#e7e2d7] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(2)}
          </div>

          {/* Bottom Face (5) */}
          <div
            className={`absolute inset-0 rounded-lg bg-gradient-to-br from-[#f6f4ee] via-[#ece7dc] to-[#ded8cc] border border-[#d6d1c4] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center ${
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
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ perspective: '800px' }}
    >
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
          <div className="relative w-40 h-28">
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
                  {render3DCube(
                    isRolling ? st.displayValue : targetValue,
                    isRolling ? false : (die?.used ?? false),
                    st.rotX,
                    st.rotY,
                    st.rotZ,
                    st.z
                  )}
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
