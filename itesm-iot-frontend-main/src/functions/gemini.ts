export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type AssessInput = {
  bpm?: number | null;
  eda?: number | null;
  temp?: number | null;
  edaSeries?: number[];
  tempSeries?: number[];
  // Optional chat fields
  message?: string; // current user message
  history?: ChatTurn[]; // prior chat turns
};

export type AssessResult = {
  text: string;
};

export async function assessUserState(input: AssessInput): Promise<AssessResult> {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = await resp.text(); } catch {}
    throw new Error(`Gemini request failed (${resp.status}): ${detail}`);
  }
  const data = await resp.json();
  return { text: data?.text ?? '' };
}
