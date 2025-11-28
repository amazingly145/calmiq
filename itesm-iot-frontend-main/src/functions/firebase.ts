import {collectionGroup, DocumentData, Firestore, getDocs, getFirestore} from "@firebase/firestore";
import {initializeApp} from "@firebase/app";

const firebaseConfig = {
    // ...
};

const app = initializeApp(firebaseConfig);
const deviceDatabase = getFirestore(app)

console.log(app.options);

async function getDeviceData(db: Firestore): Promise<DocumentData[]> {
    const readings = collectionGroup(db, "readings");
    const readingsSnapshot = await getDocs(readings);
    return readingsSnapshot.docs.map((doc) => doc.data());
}

// Keep a cached copy that can be read synchronously if needed.
export let latestDeviceData: DocumentData[] = [];

// Lazy initialize cache on-demand (avoids top-level await in client bundles)
let initPromise: Promise<void> | null = null;

async function ensureCacheInitialized() {
    if (!initPromise) {
        initPromise = getDeviceData(deviceDatabase)
            .then((data) => {
                latestDeviceData = data;
            })
            .catch(() => {
                // swallow to keep minimal surface; callers can attempt refetch later
            });
    }
    return initPromise;
}

/**
 * Fetch fresh device data from Firestore.
 * Does not mutate any React state; returns a new array of documents.
 */
export async function fetchLatestDeviceData(): Promise<DocumentData[]> {
    // Make sure cache is at least initialized once
    await ensureCacheInitialized();
    const data = await getDeviceData(deviceDatabase);
    latestDeviceData = data; // keep cache up to date
    return data;
}

// Optionally return just the cached data without another fetch
export function getCachedLatestDeviceData(): DocumentData[] {
    return latestDeviceData;
}

// --- Lightweight global polling configuration & subscription ---
export type PollingConfig = {
    enabled: boolean;
    intervalMs: number; // e.g., 10000 = 10s
};

let pollingConfig: PollingConfig = {
    enabled: false,
    intervalMs: 10000,
};

type Listener = (cfg: PollingConfig) => void;
const listeners = new Set<Listener>();

export function getPollingConfig(): PollingConfig {
    return pollingConfig;
}

export function setPollingConfig(partial: Partial<PollingConfig>) {
    const next: PollingConfig = {
        ...pollingConfig,
        ...partial,
    };
    // Normalize values
    if (!Number.isFinite(next.intervalMs) || next.intervalMs < 1000) {
        next.intervalMs = 1000; // clamp to 1s minimum to avoid abuse
    }
    pollingConfig = next;
    listeners.forEach((l) => {
        try {
            l(pollingConfig);
        } catch {
        }
    });
}

export function subscribePollingConfig(listener: Listener): () => void {
    listeners.add(listener);
    // Immediately notify with current state
    try {
        listener(pollingConfig);
    } catch {
    }
    return () => listeners.delete(listener);
}
