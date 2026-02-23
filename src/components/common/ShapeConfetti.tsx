import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Path, Circle as SvgCircle, Rect } from 'react-native-svg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SHAPE_COLORS = {
  diamond: '#FF1A6C',
  squircle: '#FFFFFF',
  circle: '#2962FF',
  triangle: '#FFBE00',
} as const;

type ShapeType = keyof typeof SHAPE_COLORS;
const SHAPE_TYPES: ShapeType[] = ['diamond', 'squircle', 'circle', 'triangle'];

const COUNT = 30;
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
const BOUNCE = 0.15;
const FLOOR_FRIC = 0.75;
const AIR_FRIC = 0.998;
const FLOOR = SCREEN_H;
const VEL_SETTLE = 3;
const MAX_FRAMES = 420;
const COL_ITERS = 12;

interface ParticleAnim {
  shape: ShapeType;
  color: string;
  x: Animated.AnimatedInterpolation<number>;
  y: Animated.AnimatedInterpolation<number>;
  rot: Animated.AnimatedInterpolation<string>;
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

function simulate(originY: number) {
  const ox = SCREEN_W / 2;

  const px = new Float64Array(COUNT);
  const py = new Float64Array(COUNT);
  const vx = new Float64Array(COUNT);
  const vy = new Float64Array(COUNT);
  const rot = new Float64Array(COUNT);
  const av = new Float64Array(COUNT);
  const ri = new Float64Array(COUNT); // per-shape collision radius
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

  // Pre-compute max possible collision distance for broad-phase skip
  const maxR = 32;
  const maxDist = maxR * 2;
  const maxDistSq = maxDist * maxDist;

  const kx: number[][] = Array.from({ length: COUNT }, () => []);
  const ky: number[][] = Array.from({ length: COUNT }, () => []);
  const kr: number[][] = Array.from({ length: COUNT }, () => []);
  let nFrames = 0;

  // Capture initial state
  for (let i = 0; i < COUNT; i++) {
    kx[i].push(px[i] - HALF);
    ky[i].push(py[i] - HALF);
    kr[i].push(rot[i]);
  }
  nFrames++;

  for (let f = 0; f < MAX_FRAMES; f++) {
    // Integrate
    for (let i = 0; i < COUNT; i++) {
      vy[i] += GRAV * DT;
      vx[i] *= AIR_FRIC;
      px[i] += vx[i] * DT;
      py[i] += vy[i] * DT;
      rot[i] += av[i] * DT;
      av[i] *= 0.92;
    }

    // Floor — per-shape radius, kill spin hard on contact
    for (let i = 0; i < COUNT; i++) {
      if (py[i] + ri[i] > FLOOR) {
        py[i] = FLOOR - ri[i];
        vy[i] = Math.abs(vy[i]) < VEL_SETTLE ? 0 : -vy[i] * BOUNCE;
        vx[i] *= FLOOR_FRIC;
        av[i] *= 0.1;
      }
    }

    // Settle rotation toward upright when nearly at rest
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

    // Walls — per-shape radius
    for (let i = 0; i < COUNT; i++) {
      if (px[i] - ri[i] < 0) {
        px[i] = ri[i];
        vx[i] = Math.abs(vx[i]) * BOUNCE;
      } else if (px[i] + ri[i] > SCREEN_W) {
        px[i] = SCREEN_W - ri[i];
        vx[i] = -Math.abs(vx[i]) * BOUNCE;
      }
    }

    // Particle-particle collisions — per-shape pair distance
    for (let iter = 0; iter < COL_ITERS; iter++) {
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

    // Re-enforce floor + walls after collision pushes — per-shape radius
    for (let i = 0; i < COUNT; i++) {
      if (py[i] + ri[i] > FLOOR) {
        py[i] = FLOOR - ri[i];
        if (vy[i] > 0) vy[i] = 0;
      }
      if (px[i] - ri[i] < 0) px[i] = ri[i];
      else if (px[i] + ri[i] > SCREEN_W) px[i] = SCREEN_W - ri[i];
    }

    // Capture keyframes AFTER collision resolution (no unresolved overlap frames)
    for (let i = 0; i < COUNT; i++) {
      kx[i].push(px[i] - HALF);
      ky[i].push(py[i] - HALF);
      kr[i].push(rot[i]);
    }
    nFrames++;

    // Settle check (only after 1.5s so everything has time to fall)
    if (f > FPS * 1.5) {
      let settled = true;
      for (let i = 0; i < COUNT; i++) {
        if (
          Math.abs(vx[i]) > VEL_SETTLE ||
          Math.abs(vy[i]) > VEL_SETTLE ||
          Math.abs(av[i]) > 0.05
        ) {
          settled = false;
          break;
        }
      }
      if (settled) {
        for (let e = 0; e < 12; e++) {
          for (let i = 0; i < COUNT; i++) {
            kx[i].push(px[i] - HALF);
            ky[i].push(py[i] - HALF);
            kr[i].push(rot[i]);
          }
          nFrames++;
        }
        break;
      }
    }
  }

  const frames = Array.from({ length: nFrames }, (_, i) => i);
  return { kx, ky, kr, frames, shapes };
}

interface ShapeConfettiProps {
  active: boolean;
  originY?: number;
}

export function ShapeConfetti({ active, originY = SCREEN_H * 0.35 }: ShapeConfettiProps) {
  const clockRef = useRef(new Animated.Value(0));
  const [particles, setParticles] = useState<ParticleAnim[]>([]);
  const animConfigRef = useRef({ to: 0, duration: 0 });

  useEffect(() => {
    if (!active) {
      clockRef.current.stopAnimation();
      clockRef.current.setValue(0);
      setParticles([]);
      return;
    }

    const { kx, ky, kr, frames, shapes } = simulate(originY);
    if (frames.length < 2) return;

    const clock = clockRef.current;
    clock.setValue(0);

    animConfigRef.current = {
      to: frames[frames.length - 1],
      duration: (frames.length / FPS) * 1000,
    };

    setParticles(
      shapes.map((shape, i) => ({
        shape,
        color: SHAPE_COLORS[shape],
        x: clock.interpolate({ inputRange: frames, outputRange: kx[i] }),
        y: clock.interpolate({ inputRange: frames, outputRange: ky[i] }),
        rot: clock.interpolate({
          inputRange: frames,
          outputRange: kr[i].map((r) => `${r}rad`),
        }),
      }))
    );
  }, [active, originY]);

  useEffect(() => {
    if (particles.length === 0) return;
    const { to, duration } = animConfigRef.current;
    const clock = clockRef.current;

    Animated.timing(clock, {
      toValue: to,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    return () => clock.stopAnimation();
  }, [particles]);

  if (particles.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              transform: [
                { translateX: p.x as any },
                { translateY: p.y as any },
                { rotate: p.rot as any },
              ],
            },
          ]}
        >
          <MemoShape shape={p.shape} color={p.color} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
});
