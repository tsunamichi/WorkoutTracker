import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';
import { DeviceMotion } from 'expo-sensors';

// Bounds read each frame in step() so rotation/window changes are respected
function getScreenBounds() {
  const { width, height } = Dimensions.get('window');
  return { w: width, h: height };
}

const SHAPE_COLORS = {
  diamond: '#FF1A6C',
  squircle: '#FFFFFF',
  circle: '#2962FF',
  triangle: '#FFBE00',
} as const;

type ShapeType = keyof typeof SHAPE_COLORS;
const SHAPE_TYPES: ShapeType[] = ['diamond', 'squircle', 'circle', 'triangle'];

const COUNT = 15;
const SIZE = 64;
const HALF = SIZE / 2;

const SHAPE_RADII: Record<ShapeType, number> = {
  circle: 32,
  diamond: 30,
  squircle: 29,
  triangle: 28,
};

const FPS = 60;
const DT = 1 / FPS;
const GRAV = 2400;
const GRAV_SCALE = GRAV / 9.81; // device m/s² -> our units; screen +Y = down
const BOUNCE = 0.15;
const FLOOR_FRIC = 0.75;
const AIR_FRIC = 0.998;
const VEL_SETTLE = 3;
const COL_ITERS = 12;
const GRAVITY_SMOOTH = 0.2; // lerp toward sensor (smoother tilt response)
const GRAVITY_SNAP = 0.45; // when gravity direction flips (e.g. phone upside down), lerp faster so shapes drop to new "down"
const FIXED_STEP_CAP = 3; // max physics steps per frame to avoid spiral of death

interface ParticleData {
  shape: ShapeType;
  color: string;
}

function ConfettiParticle({
  index,
  shape,
  color,
  state,
  frameTicker,
}: {
  index: number;
  shape: ShapeType;
  color: string;
  state: Animated.SharedValue<number[]>;
  frameTicker: Animated.SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const _ = frameTicker.value; // subscribe so we re-run every frame when positions update
    const i = index * 3;
    const x = state.value[i] ?? 0;
    const y = state.value[i + 1] ?? 0;
    const rot = state.value[i + 2] ?? 0;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}rad` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <MemoShape shape={shape} color={color} />
    </Animated.View>
  );
}

const MemoShape = React.memo(function ShapeSvg({
  shape,
  color,
}: {
  shape: ShapeType;
  color: string;
}) {
  switch (shape) {
    case 'circle':
      return (
        <Svg width={SIZE} height={SIZE}>
          <SvgCircle cx={HALF} cy={HALF} r={HALF} fill={color} />
        </Svg>
      );
    case 'diamond':
      return (
        <Svg width={SIZE} height={SIZE}>
          <Rect
            x={SIZE * 0.15}
            y={SIZE * 0.15}
            width={SIZE * 0.7}
            height={SIZE * 0.7}
            fill={color}
            rotation={45}
            origin={`${HALF},${HALF}`}
          />
        </Svg>
      );
    case 'squircle':
      return (
        <Svg width={SIZE} height={SIZE}>
          <Rect
            x={SIZE * 0.06}
            y={SIZE * 0.06}
            width={SIZE * 0.88}
            height={SIZE * 0.88}
            rx={SIZE * 0.25}
            ry={SIZE * 0.25}
            fill={color}
          />
        </Svg>
      );
    case 'triangle':
      return (
        <Svg width={SIZE} height={SIZE}>
          <Path
            d={`M${HALF} ${SIZE * 0.06}L${SIZE * 0.94} ${SIZE * 0.88}L${SIZE * 0.06} ${SIZE * 0.88}Z`}
            fill={color}
          />
        </Svg>
      );
  }
});

function initParticles(originY: number) {
  const { w: SCREEN_W } = getScreenBounds();
  const ox = SCREEN_W / 2;
  const px = new Float64Array(COUNT);
  const py = new Float64Array(COUNT);
  const vx = new Float64Array(COUNT);
  const vy = new Float64Array(COUNT);
  const rot = new Float64Array(COUNT);
  const av = new Float64Array(COUNT);
  const ri = new Float64Array(COUNT);
  const shapes: ShapeType[] = [];

  for (let i = 0; i < COUNT; i++) {
    const shape = SHAPE_TYPES[i % 4];
    shapes.push(shape);
    ri[i] = SHAPE_RADII[shape];
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
    const speed = 450 + Math.random() * 550;
    px[i] = ox + (Math.random() - 0.5) * 50;
    py[i] = originY + (Math.random() - 0.5) * 30;
    vx[i] = Math.cos(angle) * speed;
    vy[i] = Math.sin(angle) * speed;
    rot[i] = (Math.random() - 0.5) * 1.5;
    av[i] = (Math.random() - 0.5) * 4;
  }
  return { px, py, vx, vy, rot, av, ri, shapes };
}

const maxR = 32;
const maxDistSq = (maxR * 2) ** 2;

interface ShapeConfettiProps {
  active: boolean;
  originY?: number;
}

export function ShapeConfetti({
  active,
  originY = getScreenBounds().h * 0.35,
}: ShapeConfettiProps) {
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const particleState = useSharedValue<number[]>([]);
  const frameTicker = useSharedValue(0); // increment each frame so useAnimatedStyle re-runs and picks up new positions
  const physicsRef = useRef<ReturnType<typeof initParticles> | null>(null);
  const gravityRef = useRef({ gx: 0, gy: GRAV }); // raw from sensor
  const smoothedGravityRef = useRef({ gx: 0, gy: GRAV }); // lerped each frame for smooth tilt
  const rafRef = useRef<number | null>(null);

  // Gravity = direction toward physical bottom of phone (screen +X = right, +Y = down).
  // Device portrait: device X right, Y up → so (device.x, -device.y) = down in screen space.
  useEffect(() => {
    if (!active) return;
    DeviceMotion.setUpdateInterval(1000 / 60);
    const sub = DeviceMotion.addListener((data) => {
      const a = data.accelerationIncludingGravity;
      if (a) {
        gravityRef.current = {
          gx: (a.x ?? 0) * GRAV_SCALE,
          gy: -(a.y ?? -9.81) * GRAV_SCALE,
        };
      }
    });
    return () => sub.remove();
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setParticles([]);
      physicsRef.current = null;
      return;
    }

    const { px, py, vx, vy, rot, av, ri, shapes } = initParticles(originY);
    physicsRef.current = { px, py, vx, vy, rot, av, ri, shapes };

    const initial: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      initial.push(px[i] - HALF, py[i] - HALF, rot[i]);
    }
    particleState.value = initial;
    setParticles(shapes.map((shape) => ({ shape, color: SHAPE_COLORS[shape] })));
    smoothedGravityRef.current = { gx: 0, gy: GRAV };

    let lastTs = 0;
    let acc = 0;

    function step(ts: number) {
      const phys = physicsRef.current;
      if (!phys) return;
      const { w: SCREEN_W, h: SCREEN_H } = getScreenBounds();
      const { px, py, vx, vy, rot, av, ri, shapes } = phys;
      const raw = gravityRef.current;
      const sm = smoothedGravityRef.current;
      // When gravity direction flips (e.g. phone turned upside down), snap faster so shapes fall toward new physical bottom
      const signFlip =
        (raw.gx * sm.gx < 0 && Math.abs(raw.gx) > 50) ||
        (raw.gy * sm.gy < 0 && Math.abs(raw.gy) > 50);
      const smooth = signFlip ? GRAVITY_SNAP : GRAVITY_SMOOTH;
      sm.gx += (raw.gx - sm.gx) * smooth;
      sm.gy += (raw.gy - sm.gy) * smooth;
      const gx = sm.gx;
      const gy = sm.gy;

      const delta = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : DT;
      lastTs = ts;
      acc += delta;
      let steps = 0;
      while (acc >= DT && steps < FIXED_STEP_CAP) {
        acc -= DT;
        steps++;
        // Integrate: gravity points toward physical bottom of phone
        for (let i = 0; i < COUNT; i++) {
          vx[i] += gx * DT;
          vy[i] += gy * DT;
          vx[i] *= AIR_FRIC;
          vy[i] *= AIR_FRIC;
          px[i] += vx[i] * DT;
          py[i] += vy[i] * DT;
          rot[i] += av[i] * DT;
          av[i] *= 0.92;
        }

        // Four walls: keep shapes on screen so they pile toward "down" side when you tilt
        for (let i = 0; i < COUNT; i++) {
          const r = ri[i];
          if (py[i] + r > SCREEN_H) {
            py[i] = SCREEN_H - r;
            vy[i] = Math.abs(vy[i]) < VEL_SETTLE ? 0 : -vy[i] * BOUNCE;
            vx[i] *= FLOOR_FRIC;
            av[i] *= 0.1;
          }
          if (py[i] - r < 0) {
            py[i] = r;
            vy[i] = Math.abs(vy[i]) * BOUNCE;
            vx[i] *= FLOOR_FRIC;
          }
          if (px[i] - r < 0) {
            px[i] = r;
            vx[i] = Math.abs(vx[i]) * BOUNCE;
          } else if (px[i] + r > SCREEN_W) {
            px[i] = SCREEN_W - r;
            vx[i] = -Math.abs(vx[i]) * BOUNCE;
          }
        }

        // Settle rotation
        for (let i = 0; i < COUNT; i++) {
          const speed = Math.abs(vx[i]) + Math.abs(vy[i]);
          if (speed < 60) {
            const uprightTarget = Math.round(rot[i] / (Math.PI * 2)) * (Math.PI * 2);
            const diff = uprightTarget - rot[i];
            const blend = speed < 15 ? 0.15 : 0.06;
            rot[i] += diff * blend;
            av[i] *= 0.6;
            if (Math.abs(av[i]) < 0.05) av[i] = 0;
          }
        }

        // Particle-particle collisions
        let totalSpeed = 0;
        for (let i = 0; i < COUNT; i++) totalSpeed += Math.abs(vx[i]) + Math.abs(vy[i]);
        const iters = totalSpeed < 200 ? 3 : COL_ITERS;
        for (let iter = 0; iter < iters; iter++) {
          for (let i = 0; i < COUNT; i++) {
            for (let j = i + 1; j < COUNT; j++) {
              const dx = px[j] - px[i];
              const dy = py[j] - py[i];
              const dSq = dx * dx + dy * dy;
              if (dSq > maxDistSq || dSq < 0.001) continue;
              const minDist = ri[i] + ri[j];
              if (dSq >= minDist * minDist) continue;
              const d = Math.sqrt(dSq);
              const nx = dx / d;
              const ny = dy / d;
              const ov = minDist - d;
              px[i] -= nx * ov * 0.5;
              py[i] -= ny * ov * 0.5;
              px[j] += nx * ov * 0.5;
              py[j] += ny * ov * 0.5;
              const rvn = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
              if (rvn > 0) {
                const imp = rvn * 0.5 * (1 + BOUNCE);
                vx[i] -= imp * nx;
                vy[i] -= imp * ny;
                vx[j] += imp * nx;
                vy[j] += imp * ny;
              }
            }
          }
        }

        // Re-enforce bounds
        for (let i = 0; i < COUNT; i++) {
          const r = ri[i];
          if (py[i] + r > SCREEN_H) {
            py[i] = SCREEN_H - r;
            if (vy[i] > 0) vy[i] = 0;
          }
          if (py[i] - r < 0) py[i] = r;
          if (px[i] - r < 0) px[i] = r;
          else if (px[i] + r > SCREEN_W) px[i] = SCREEN_W - r;
        }
      }

      // Update Reanimated shared values so UI thread picks up new positions every frame
      const next: number[] = [];
      for (let i = 0; i < COUNT; i++) {
        next.push(px[i] - HALF, py[i] - HALF, rot[i]);
      }
      particleState.value = next;
      frameTicker.value = frameTicker.value + 1;

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, originY]);

  if (particles.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiParticle
          key={i}
          index={i}
          shape={p.shape}
          color={p.color}
          state={particleState}
          frameTicker={frameTicker}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
});
