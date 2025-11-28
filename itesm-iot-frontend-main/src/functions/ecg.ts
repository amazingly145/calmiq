export function ecgSample(t: number, bpm: number): number {
    const beatLength = 60 / bpm;
    const phase = (t % beatLength) / beatLength;

    const gauss = (x: number, mu: number, sigma: number, amp: number) =>
        amp * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));

    const p  = gauss(phase, 0.18, 0.025, 0.15);
    const q  = gauss(phase, 0.34, 0.010, -0.25);
    const r  = gauss(phase, 0.36, 0.008, 1.2);
    const s  = gauss(phase, 0.39, 0.010, -0.35);
    const tW = gauss(phase, 0.62, 0.045, 0.35);

    return p + q + r + s + tW;
}

export function generateECG(
    durationSec: number,
    bpm: number,
    sampleRate = 250
) {
    const dt = 1 / sampleRate;
    const samples: { t: number; v: number }[] = [];

    for (let t = 0; t < durationSec; t += dt) {
        samples.push({ t, v: ecgSample(t, bpm) });
    }

    return samples;
}
