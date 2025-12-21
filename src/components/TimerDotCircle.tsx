import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants';

interface TimerDotCircleProps {
  progress: number; // 0 to 1, where 1 is full time remaining
  size?: number; // Diameter of the circle
  isWorkPhase?: boolean; // true for work, false for rest
  totalSeconds?: number; // Total duration of current phase in seconds
}

interface Dot {
  x: number;
  y: number;
  distanceFromCenter: number;
}

export function TimerDotCircle({ 
  progress, 
  size = 300,
  isWorkPhase = true,
  totalSeconds = 30
}: TimerDotCircleProps) {
  const dots = useMemo(() => {
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Dynamic sizing based on container size
    // Scale everything proportionally from the base 300px design
    const baseSize = 300;
    const scale = size / baseSize;
    
    // Centered hexagonal rings (Braun/Dieter Rams style)
    // Layer 1: 1 dot (center)
    // Layer n: 6 × (n - 1) dots
    // Total for 6 layers: 1 + 6 + 12 + 18 + 24 + 30 = 91
    // Total for 7 layers: 1 + 6 + 12 + 18 + 24 + 30 + 36 = 127
    
    const ringSpacing = 21 * scale; // Distance between concentric rings (scaled)
    const layers = 6; // Number of layers (6 layers gives 1+6+12+18+24+30+36 = 127 dots)
    
    // Group dots by layer
    const dotsByLayer: Dot[][] = [];
    
    // Layer 0: Center dot
    dotsByLayer.push([{
      x: centerX,
      y: centerY,
      distanceFromCenter: 0
    }]);
    
    // Generate concentric hexagonal rings using axial coordinates
    // For each ring, walk around the hexagon perimeter
    for (let layer = 1; layer <= layers; layer++) {
      const radius = layer * ringSpacing;
      const dotsInLayer = 6 * layer;
      const layerDots: Dot[] = [];
      
      // Walk around the hexagon using the 6 cardinal directions
      // Starting from the "east" point and going counter-clockwise
      for (let i = 0; i < dotsInLayer; i++) {
        // Distribute dots evenly around the ring
        const angle = (i / dotsInLayer) * Math.PI * 2; // Start from right (rotated 90° clockwise)
        
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        layerDots.push({ 
          x, 
          y, 
          distanceFromCenter: radius 
        });
      }
      
      // Randomize order within this layer using a seeded shuffle
      // Use layer index as seed for consistent randomization
      const shuffled = [...layerDots];
      let seed = layer * 9999;
      for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 9301 + 49297) % 233280;
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      dotsByLayer.push(shuffled);
    }
    
    // Flatten layers in order (inside-out for both work and rest)
    // Work phase: dots disappear from center outward
    // Rest phase: dots appear from center outward
    const dotsArray = dotsByLayer.flat();
    
    console.log(`Generated ${dotsArray.length} dots in ${layers} concentric rings with randomized order per ring`);
    
    return dotsArray;
  }, [size, isWorkPhase]);

  // Animated progress value that smoothly interpolates between updates
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const previousPhase = useRef(isWorkPhase);
  const previousProgress = useRef(progress);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  
  // Handle progress updates and phase changes
  useEffect(() => {
    const phaseChanged = previousPhase.current !== isWorkPhase;
    const progressChanged = previousProgress.current !== progress;
    
    if (phaseChanged) {
      // Phase changed - immediately jump to new progress without animation
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      animatedProgress.setValue(progress);
      previousPhase.current = isWorkPhase;
      previousProgress.current = progress;
    } else if (progressChanged) {
      // Progress changed within same phase - smoothly animate
      if (animationRef.current) {
        animationRef.current.stop();
      }
      
      animationRef.current = Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 950, // Slightly less than 1 second to complete before next tick
        useNativeDriver: true,
      });
      animationRef.current.start();
      previousProgress.current = progress;
    }
  }, [progress, isWorkPhase, animatedProgress]);
  
  const totalDots = dots.length;
  
  // Dynamic dot size based on container size
  const baseSize = 300;
  const scale = size / baseSize;
  const dotSize = 8 * scale;
  
  // Determine colors based on phase
  // Both phases: base layer is light background, active layer is dark text
  const inactiveColor = COLORS.backgroundContainer;
  const activeColor = COLORS.text;
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Render inactive dots (base layer) */}
      {dots.map((dot, index) => (
        <View
          key={`inactive-${index}`}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              left: dot.x - dotSize / 2,
              top: dot.y - dotSize / 2,
              backgroundColor: inactiveColor,
            },
          ]}
        />
      ))}
      
      {/* Render active dots (top layer with animated opacity) */}
      {dots.map((dot, index) => {
        // Interpolate opacity based on animated progress
        // As progress decreases from 1.0 to 0.0:
        // - Work phase: dots fade OUT from center outward (index 0 first, high index last)
        // - Rest phase: dots fade IN from center outward (index 0 first, high index last)
        
        // For rest phase, reverse the index so center dots (i=0) have HIGH inputRange values
        // and fade in when progress is still HIGH (early in the rest phase)
        const effectiveIndex = isWorkPhase ? index : (totalDots - 1 - index);
        
        // Dynamically adjust fade width based on phase duration
        // Calculate how much time each dot should have to fade
        // For smooth animation: each dot gets (totalSeconds * 1000ms / totalDots) to fade
        // Scale this relative to the animation duration (950ms)
        const msPerDot = (totalSeconds * 1000) / totalDots; // milliseconds per dot
        const animationDuration = 950; // ms - must match the Animated.timing duration
        const optimalFadeRatio = Math.min(msPerDot / animationDuration, 1); // Don't exceed 100%
        
        const dotStep = 1 / totalDots;
        const fadeWidth = dotStep * Math.max(1, optimalFadeRatio * totalDots / 10);
        const startProgress = effectiveIndex / totalDots;
        
        const dotOpacity = animatedProgress.interpolate({
          inputRange: [
            Math.max(0, startProgress),                    // Start fade
            Math.min(1, startProgress + fadeWidth),        // End fade
          ],
          outputRange: isWorkPhase ? [0, 1] : [1, 0], // Work: fade out, Rest: fade in
          extrapolate: 'clamp',
        });
        
        return (
          <Animated.View
            key={`active-${index}`}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                left: dot.x - dotSize / 2,
                top: dot.y - dotSize / 2,
                backgroundColor: activeColor,
                opacity: dotOpacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
  },
});

