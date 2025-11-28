import {faker} from "@faker-js/faker";

export function generateHormoneWavePoint(t: number) {
    // Baseline rhythmic cycle
    const base = Math.sin(t * 0.05);

    // Slow drifting offset – hormones love drifting
    const drift = faker.number.float({min: 10, max: 20});

    // Occasional erratic modulation
    const microJitter = faker.number.float({min: 4, max: 7});

    // Combine them into a wave-like value
    return base + drift + microJitter;
}

export function generateHormoneWavePoints(
    durationSec: number,
    frequency: number = 250
) {
    const dt = 1 / frequency;
    const samples: { t: number; v: number }[] = [];

    for (let t = 0; t < durationSec; t += dt) {
        samples.push({t, v: generateHormoneWavePoint(t)});
    }

    return samples;
}
