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
  throwSide?: 'left' | 'right';
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
  bounced: boolean;
  age: number;
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

export const DicePhysicsView: React.FC<DicePhysicsProps> = ({
  dice,
  isRolling,
  rollSequence = 0,
  canRoll,
  onRollClick,
  className = '',
  throwSide = 'right',
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
  const renderFacePips = (val: number, blurred = false) => {
    const pipPositions: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 3, 6, 2, 5, 8],
    };
    const activePips = pipPositions[val] || [4];

    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1 gap-0 pointer-events-none" style={{ filter: blurred ? 'blur(1.05px)' : 'none' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activePips.includes(i) && (
              <div
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: 'radial-gradient(circle at 34% 28%, #39352f 0%, #171411 58%, #080706 100%)',
                  boxShadow: 'inset 0 1px 1.2px rgba(255,255,255,0.2), inset 0 -1px 1.4px rgba(0,0,0,0.95), 0 0.5px 0.5px rgba(255,255,255,0.28)',
                }}
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
        // Every throw starts at the outer edge, never at the previous landing point.
        // The dice travel at a steady pace, hit the centre bar, then rebound at half speed.
        newStates.push({
          x: throwSide === 'right' ? 118 : -118,
          y: count === 1 ? 0 : (i === 0 ? -18 : 18),
          vx: throwSide === 'right' ? -190 : 190,
          vy: count === 1 ? 0 : (i === 0 ? -8 : 8),
          z: 0,
          vz: 0,
          rotX: 0,
          rotY: 0,
          rotZ: i === 0 ? -8 : 8,
          vRotX: 0,
          vRotY: 0,
          vRotZ: i === 0 ? 620 : -590,
          displayValue: 1,
          settled: false,
          bounced: false,
          age: 0,
        });
      }

      setPhysicsStates(newStates);
      lastTimeRef.current = performance.now();
    }
  }, [isRolling, rollSequence, throwSide]);

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
          x: (throwSide === 'right' ? 22 : -22) + (i === 0 ? -9 : 9),
          y: (i - (visibleDice.length - 1) / 2) * 30 + (i === 0 ? -7 : 7),
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
          bounced: true,
          age: 0,
        };
      }));
      return;
    }

    setPhysicsStates(current.map((state, i) => {
      const value = resultDice[i]?.value || 1;
      const target = FACE_ROTATIONS[value] || { rx: 0, ry: 0 };
      return {
        ...state,
        // Preserve where each die actually bounced; do not snap them into
        // a perfectly aligned pair when the result arrives.
        x: state.x,
        y: state.y,
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
        bounced: true,
        age: state.age,
      };
    }));
  }, [isRolling, dice.length, throwSide]);

  // Time-based roll: approach the centre bar, rebound at half speed,
  // then naturally lose momentum while the top face keeps spinning.
  useEffect(() => {
    if (!isRolling) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const step = (time: number) => {
      const dt = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.032);
      lastTimeRef.current = time;

      setPhysicsStates((prev) => {
        if (settlingRef.current) return prev;
        return prev.map((die, idx) => {
          if (die.settled) return die;

          let { x, y, vx, vy, z, vz, rotZ, vRotZ, age, bounced } = die;
          age += dt;

          // Smooth travel toward the centre. The bar collision reverses the
          // horizontal velocity with exactly half of the incoming speed.
          x += vx * dt;
          y += vy * dt;

          const centreHit = throwSide === 'right' ? x <= 0 : x >= 0;
          if (!bounced && centreHit) {
            x = 0;
            vx = throwSide === 'right' ? 95 : -95;
            vy += idx === 0 ? -13 : 13;
            vz = 52;
            bounced = true;
            const now = performance.now();
            if (now - lastImpactSoundRef.current > 120) {
              lastImpactSoundRef.current = now;
              tavlaAudio.playDiceDrop();
            }
          }

          // Friction starts after the centre-bar rebound, not during the run-up.
          if (bounced) {
            const friction = Math.exp(-1.3 * dt);
            vx *= friction;
            vy *= Math.exp(-1.3 * dt);
            vRotZ *= Math.exp(-2.2 * dt);
          }

          // A small, visible tabletop hop accompanies the horizontal rebound.
          if (z > 0 || vz > 0) {
            vz -= 760 * dt;
            z += vz * dt;
            if (z <= 0) {
              z = 0;
              if (Math.abs(vz) > 18) {
                vz = -vz * 0.24;
              } else {
                vz = 0;
              }
            }
          }

          rotZ += vRotZ * dt;
          const displayValue = (Math.floor(age * 13 + idx * 2) % 6) + 1;

          // Finish only after the rebound has visibly travelled and all
          // horizontal and rotational movement has nearly faded out.
          const settled = bounced && age > 1.25 &&
            Math.abs(vx) < 7 && Math.abs(vy) < 5 && Math.abs(vRotZ) < 42 &&
            z === 0 && Math.abs(vz) < 1;

          return {
            ...die,
            x, y, vx, vy, z, vz, rotZ, vRotZ,
            rotX: 0,
            rotY: 0,
            vRotX: 0,
            vRotY: 0,
            displayValue,
            bounced,
            age,
            settled,
          };
        });
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRolling, rollSequence, throwSide]);

  // Dice face renderer for 3D cube representation
  const render3DCube = (
    value: number,
    isUsed: boolean,
    rotX: number,
    rotY: number,
    rotZ: number,
    zHeight: number,
    rolling: boolean
  ) => {
    const size = 28; // Slightly smaller dice for a cleaner landing
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
            {renderFacePips(rolling ? value : 1, rolling)}
          </div>

          {/* Back Face (6) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fff9e9] via-[#e9dcc0] to-[#bda77f] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
          >
            {renderFacePips(rolling ? value : 6, rolling)}
          </div>

          {/* Right Face (3) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fffaf0] via-[#eadfc9] to-[#c4ad87] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.2)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(rolling ? value : 3, rolling)}
          </div>

          {/* Left Face (4) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#fff9e9] via-[#e9dcc0] to-[#bda77f] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(rolling ? value : 4, rolling)}
          </div>

          {/* Top Face (2) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white via-[#f1f5f9] to-[#cbd5e1] border border-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.98),inset_0_-3px_5px_rgba(15,23,42,0.2)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(rolling ? value : 2, rolling)}
          </div>

          {/* Bottom Face (5) */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br from-[#e9dcc1] via-[#d5c29f] to-[#a68d66] border border-[#f8edda] shadow-[inset_0_2px_3px_rgba(255,255,255,0.92),inset_0_-3px_5px_rgba(15,23,42,0.22)] flex items-center justify-center ${
              isUsed ? 'opacity-35 grayscale' : ''
            }`}
            style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }}
          >
            {renderFacePips(rolling ? value : 5, rolling)}
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
      className={`relative z-[999] flex items-center justify-center select-none pointer-events-none overflow-visible ${className}`}
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
          <div className="relative w-36 h-24 overflow-visible">
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
                  <div>
                    {render3DCube(
                      isRolling ? st.displayValue : targetValue,
                      isRolling ? false : (die?.used ?? false),
                      isRolling ? st.rotX : targetRot.rx,
                      isRolling ? st.rotY : targetRot.ry,
                      isRolling ? st.rotZ : 0,
                      st.z,
                      isRolling
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
