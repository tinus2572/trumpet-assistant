// Pitch detection using the YIN algorithm (adapted for Bb trumpet)
// YIN is much more robust than basic autocorrelation at avoiding
// octave errors, especially in the lower register.

const YIN_THRESHOLD = 0.2;
// Threshold for accepting an octave-up candidate (lag / 2)
const OCTAVE_CHECK_THRESHOLD = 0.35;

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number
): number | null {
  const SIZE = buffer.length;
  const halfSize = Math.floor(SIZE / 2);

  // Check if there is enough signal (volume threshold)
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // Too quiet

  // Bb trumpet frequency range: ~78 Hz (concert E2 = written Fa#2) to ~1200 Hz
  const minLag = Math.floor(sampleRate / 1200);
  const maxLag = Math.min(Math.floor(sampleRate / 78), halfSize);

  // Step 1: Difference function
  const yinBuffer = new Float32Array(maxLag + 1);
  yinBuffer[0] = 1;

  for (let tau = 1; tau <= maxLag; tau++) {
    let diff = 0;
    const W = halfSize;
    for (let j = 0; j < W; j++) {
      const delta = buffer[j] - buffer[j + tau];
      diff += delta * delta;
    }
    yinBuffer[tau] = diff;
  }

  // Step 2: Cumulative mean normalized difference function (CMNDF)
  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum > 0 ? (yinBuffer[tau] * tau) / runningSum : 1;
  }

  // Step 3: Absolute threshold — find first dip below threshold
  let bestTau = -1;
  for (let tau = minLag; tau < maxLag; tau++) {
    if (yinBuffer[tau] < YIN_THRESHOLD) {
      // Find the local minimum in this valley
      while (tau + 1 < maxLag && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // Fallback: if no dip below threshold, take the global minimum
  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minLag; tau < maxLag; tau++) {
      if (yinBuffer[tau] < minVal) {
        minVal = yinBuffer[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.5) return null;
  }

  if (bestTau === -1) return null;

  // Step 3.5: Octave correction
  // Check if the half-lag (octave above) is also a reasonable minimum.
  // If so, it is probably the true fundamental and we found the sub-harmonic.
  const halfTau = Math.round(bestTau / 2);
  if (halfTau >= minLag && yinBuffer[halfTau] < OCTAVE_CHECK_THRESHOLD) {
    bestTau = halfTau;
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  const prev = bestTau > 0 ? yinBuffer[bestTau - 1] : yinBuffer[bestTau];
  const curr = yinBuffer[bestTau];
  const next = bestTau < maxLag ? yinBuffer[bestTau + 1] : yinBuffer[bestTau];
  const denom = 2 * curr - prev - next;
  const shift = denom !== 0 ? (prev - next) / (2 * denom) : 0;
  const refinedTau = bestTau + (isFinite(shift) ? shift : 0);

  const frequency = sampleRate / refinedTau;

  if (frequency < 78 || frequency > 1200) return null;

  return frequency;
}
