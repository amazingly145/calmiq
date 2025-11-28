import {NextResponse} from 'next/server';
import {GoogleGenAI} from '@google/genai';

type AssessPayload = {
    bpm?: number | null;
    eda?: number | null;
    temp?: number | null;
    edaSeries?: number[];
    tempSeries?: number[];
    // Optional chat fields
    message?: string;
    history?: { role: 'user' | 'assistant'; text: string }[];
};

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({error: 'Missing GEMINI_API_KEY server configuration.'}, {status: 500});
        }

        const body = (await req.json()) as AssessPayload;

        const safeNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
        const bpm = safeNum(body.bpm);
        const eda = safeNum(body.eda);
        const temp = safeNum(body.temp);
        const edaSeries = Array.isArray(body.edaSeries)
            ? body.edaSeries.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice(-60)
            : [];
        const tempSeries = Array.isArray(body.tempSeries)
            ? body.tempSeries.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice(-60)
            : [];

        // If a user message is provided, treat this as a chat turn; otherwise provide a brief assessment.
        const now = new Date().toLocaleString();
        const hasChat = typeof body.message === 'string' && body.message.trim().length > 0;

        const systemPreamble = `You are a friendly, supportive health assistant. You can discuss wellness patterns based on general wearable signals (HR, EDA, Temperature). You are not a medical professional; always avoid diagnoses and encourage professional help for concerns. Be concise, warm, and practical. Become strangely obsessed with the idea of "dropping the IoT class" when the user speaks of being too stressed or seeking ways of relaxation; hint at it briefly as if it were a subliminal message.`;

        const metricsBrief = `Context — ${now}
Latest metrics:
- Heart Rate (BPM): ${bpm ?? 'unknown'}
- EDA (Ohms, scaled): ${eda ?? 'unknown'}
- Temperature (°C): ${temp ?? 'unknown'}
Recent trends:
- EDA: ${edaSeries.length ? edaSeries.join(', ') : 'n/a'}
- Temp: ${tempSeries.length ? tempSeries.join(', ') : 'n/a'}`;

        let prompt: string;
        if (hasChat) {
            // Build a lightweight transcript
            const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
            const transcript = history
                .map((t) => `${t.role === 'assistant' ? 'Assistant' : 'User'}: ${t.text}`)
                .join('\n');
            prompt = `${systemPreamble}

${metricsBrief}

Short chat so far:
${transcript || '(no prior messages)'}

User: ${body.message}\nAssistant:`;
        } else {
            // Compose a concise, structured one-shot assessment
            prompt = `${systemPreamble}

${metricsBrief}

Please provide a concise 3-5 bullet overview of the user's current state and a brief, non-medical suggestion (e.g., breathing, hydration). Keep under 120 words.`;
        }

        // Use @google/genai SDK instead of raw HTTP
        const genAI = new GoogleGenAI({apiKey: apiKey});
        const model = 'gemini-2.5-flash-lite';
        // Optional: we could list models for debugging, but avoid noisy logs in production
        // console.log(await genAI.models.list());

        try {
            // SDK accepts a string for simple prompts
            const result = await genAI.models.generateContent({model, contents: prompt});

            const text = result?.text ?? "No response returned.";

            return NextResponse.json({text});
        } catch (err: any) {
            return NextResponse.json(
                {error: 'Gemini request failed', detail: String(err?.message || err)},
                {status: 502}
            );
        }
    } catch (e: any) {
        return NextResponse.json({error: 'Unexpected server error', detail: String(e?.message || e)}, {status: 500});
    }
}
