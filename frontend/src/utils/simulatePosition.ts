export type SimulatedPositionInput = {
  vehiculeId: string;
  latitude: number;
  longitude: number;
  vitesse?: number;
  cap?: number;
  precision?: number;
  correlationId?: string;
};

type SendPosition = (input: SimulatedPositionInput) => Promise<void>;

type SimulateOptions = {
  vehiculeId: string;
  startLat: number;
  startLng: number;
  steps?: number;
  intervalMs?: number;
  precision?: number;
  sendPosition: SendPosition;
  signal?: AbortSignal;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function computeHeading(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x);
  return (toDegrees(brng) + 360) % 360;
}

function buildRoute(startLat: number, startLng: number, steps: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const radius = 0.01; // approx ~1km
  for (let i = 0; i < steps; i += 1) {
    const angle = (2 * Math.PI * i) / steps;
    const lat = startLat + radius * Math.cos(angle);
    const lng = startLng + radius * Math.sin(angle);
    points.push([lat, lng]);
  }
  return points;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!ms) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      }, { once: true });
    }
  });
}

export async function simulatePositions(options: SimulateOptions): Promise<void> {
  const steps = options.steps ?? 24;
  const intervalMs = options.intervalMs ?? 800;
  const precision = options.precision ?? 8;
  const route = buildRoute(options.startLat, options.startLng, steps);

  for (let i = 0; i < route.length; i += 1) {
    if (options.signal?.aborted) return;
    const [lat, lng] = route[i];
    const [nextLat, nextLng] = route[(i + 1) % route.length];
    const cap = computeHeading(lat, lng, nextLat, nextLng);
    const vitesse = 30 + Math.round(20 * Math.sin(i / 3));

    await options.sendPosition({
      vehiculeId: options.vehiculeId,
      latitude: lat,
      longitude: lng,
      vitesse,
      cap,
      precision,
      correlationId: `sim-${options.vehiculeId}-${i}`,
    });

    try {
      await sleep(intervalMs, options.signal);
    } catch {
      return;
    }
  }
}

