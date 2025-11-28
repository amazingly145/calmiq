'use client'

import {Line} from 'react-chartjs-2';
import {generateECG} from "@/functions/ecg";
import React, {useEffect, useMemo, useState} from "react";
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import {
    ActivityIcon,
    BandageIcon,
    BrainIcon,
    HeartIcon,
    HeartPulseIcon,
    OmegaIcon,
    ThermometerIcon,
    ThermometerSunIcon
} from "lucide-react";
import {
    fetchLatestDeviceData,
    getCachedLatestDeviceData,
    getPollingConfig,
    type PollingConfig,
    subscribePollingConfig
} from "@/functions/firebase";
import {generateHormoneWavePoints} from "@/functions/cortisol";
import {assessUserState, type ChatTurn} from "@/functions/gemini";
import Markdown from "react-markdown";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

export default function ContentIsland() {
    // Hold device data and keep it reactive to latestDeviceData
    const [deviceData, setDeviceData] = useState<any[]>(() => getCachedLatestDeviceData?.() ?? []);

    // Poll for latest data periodically based on global polling config
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const fresh = await fetchLatestDeviceData();
                if (isMounted) setDeviceData(fresh ?? []);
            } catch (e) {
                // ignore for now; minimal changes
            }
        };
        // initial load
        load();

        // Track current polling config
        let cfg: PollingConfig = getPollingConfig();
        let timer: ReturnType<typeof setInterval> | null = null;

        const startTimer = () => {
            if (!cfg.enabled) return;
            if (timer) clearInterval(timer);
            timer = setInterval(load, cfg.intervalMs);
        };

        const stopTimer = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };

        // Subscribe to config changes
        const unsubscribe = subscribePollingConfig((next) => {
            cfg = next;
            stopTimer();
            startTimer();
        });

        // Start based on initial cfg
        startTimer();

        return () => {
            isMounted = false;
            stopTimer();
            unsubscribe();
        };
    }, []);

    // Derive charts from the current deviceData
    const bpm: number = useMemo(() => {
        if (!deviceData || deviceData.length === 0) return 60;
        const last = deviceData[deviceData.length - 1];
        return (last?.bpm as number) ?? 60;
    }, [deviceData]);

    const ecg_sim = useMemo(() => generateECG(10, bpm), [bpm]);
    const crt_sim = useMemo(() => generateHormoneWavePoints(bpm / 30, 3), [bpm]);

    const ecg_data = useMemo(() => ({
        labels: ecg_sim.map((s) => s.t.toFixed(2).toString()),
        datasets: [{
            label: 'ECG Data',
            data: ecg_sim.map((s) => s.v),
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            pointStyle: false,
            tension: 0.1
        }]
    }), [ecg_sim]);

    const eda_data = useMemo(() => ({
        labels: (deviceData ?? []).map((_, i) => i),
        datasets: [{
            label: 'EDA',
            data: (deviceData ?? []).map((s: any) => s['eda_ave'] * 0.040),
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            pointStyle: false,
            tension: 0.1
        }]
    }), [deviceData]);

    const crt_data = useMemo(() => ({
        labels: crt_sim.map((s) => s.t.toFixed(2).toString()),
        datasets: [{
            label: 'Cortisol',
            data: crt_sim.map((s) => s.v),
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            pointStyle: false,
            tension: 0.1
        }]
    }), [crt_sim]);

    const temp_data = useMemo(() => ({
        labels: (deviceData ?? []).map((_: any, i: number) => i),
        datasets: [{
            label: 'Temperature',
            data: (deviceData ?? []).map((s: any) => s['temp_ave']),
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            pointStyle: false,
            tension: 0.1
        }]
    }), [deviceData]);

    // Latest point helpers for badges (auto-update via deviceData)
    const latestEda: number | null = useMemo(() => {
        const arr = (deviceData ?? [])
            .map((s: any) => s['eda_ave'])
            .filter((v: any) => typeof v === 'number' && !Number.isNaN(v));
        return arr.length ? (arr[arr.length - 1] as number * 0.040) : null;
    }, [deviceData]);

    const latestTemp: number | null = useMemo(() => {
        const arr = (deviceData ?? [])
            .map((s: any) => s['temp_ave'])
            .filter((v: any) => typeof v === 'number' && !Number.isNaN(v));
        return arr.length ? (arr[arr.length - 1] as number) : null;
    }, [deviceData]);

    const latestCort: number | null = useMemo(() => {
        const arr = (crt_data.datasets[0].data ?? [])
            .filter((v: any) => typeof v === 'number' && !Number.isNaN(v));
        return arr.length ? (arr[arr.length - 1] as number) : null;
    }, [crt_data])?.toFixed(2);

    // --- AI Overview Chat state ---
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState<string>("");
    const [messages, setMessages] = useState<ChatTurn[]>([{
        role: 'assistant',
        text: "Hi! I'm your health assistant. I can discuss your recent heart rate, EDA, and temperature trends and share general wellness tips. How can I help today?"
    }]);

    const chatEndRef = React.useRef<HTMLDivElement | null>(null);
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({behavior: 'smooth'});
    };
    useEffect(() => {
        scrollToBottom();
    }, [messages, aiLoading]);

    const sendMessage = async (text?: string) => {
        const content = (text ?? chatInput).trim();
        if (!content || aiLoading) return;
        setAiError(null);
        setAiLoading(true);
        setChatInput("");

        // Optimistically add user message
        setMessages((prev) => [...prev, {role: 'user', text: content}]);

        try {
            // Fetch fresh data first for contextual answers
            const fresh = await fetchLatestDeviceData();
            const last = fresh?.[fresh.length - 1] ?? null;
            const latestBpm = (last?.bpm as number) ?? bpm ?? 60;
            const latestEdaVal = typeof last?.eda_ave === 'number' ? last.eda_ave * 0.040 : latestEda ?? null;
            const latestTempVal = typeof last?.temp_ave === 'number' ? last.temp_ave : latestTemp ?? null;
            const edaSeries = (fresh ?? [])
                .map((s: any) => (typeof s?.eda_ave === 'number' ? s.eda_ave * 0.040 : null))
                .filter((n: any) => typeof n === 'number' && Number.isFinite(n));
            const tempSeries = (fresh ?? [])
                .map((s: any) => (typeof s?.temp_ave === 'number' ? s.temp_ave : null))
                .filter((n: any) => typeof n === 'number' && Number.isFinite(n));

            const history: ChatTurn[] = messages.slice(-10); // last 10 turns
            const res = await assessUserState({
                bpm: latestBpm,
                eda: latestEdaVal as number | null,
                temp: latestTempVal as number | null,
                edaSeries,
                tempSeries,
                message: content,
                history,
            });

            const reply = res.text || "";
            setMessages((prev) => [...prev, {role: 'assistant', text: reply}]);
        } catch (e: any) {
            setAiError(String(e?.message || e) ?? 'Failed to get response');
            // Rollback assistant message not needed; user message stays
        } finally {
            setAiLoading(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
        }
    };

    return (
        <div className="w-full h-full bg-gray-100 rounded-md p-4 gap-4 grid grid-cols-3 grid-rows-2 overflow-auto">
            {/* Left: AI Overview spanning two rows */}
            <div className="col-span-1 row-span-2 bg-white rounded-md p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-3 text-lg text-black font-black">
                    <BrainIcon/>
                    <p>AI Overview</p>
                </div>

                {/* Chat area */}
                <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-md bg-slate-50 p-3">
                    <div className="flex flex-col gap-2">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white text-slate-900 border border-slate-200'} max-w-[85%] rounded-2xl px-4 py-2 shadow-sm whitespace-pre-wrap`}>
                                    <Markdown>{m.text}</Markdown>
                                </div>
                            </div>
                        ))}
                        {aiLoading && (
                            <div className="flex justify-start">
                                <div
                                    className="bg-white text-slate-500 border border-slate-200 max-w-[85%] rounded-2xl px-4 py-2 shadow-sm">
                                    Thinking…
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef}/>
                    </div>
                </div>

                {/* Composer */}
                <div className="mt-3">
                    {aiError && (
                        <div className="mb-2 text-red-600 text-sm">{aiError}</div>
                    )}
                    <div className="flex items-end gap-2 text-gray-500">
                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            rows={2}
                            placeholder="Ask about your recent trends or get tips…"
                            className="flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
                        />
                        <button
                            onClick={() => void sendMessage()}
                            disabled={aiLoading || chatInput.trim().length === 0}
                            className="h-10 px-4 rounded-md bg-teal-600 text-white text-sm disabled:opacity-60"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: 2x2 grid for physiological cards */}
            <div className="col-span-2 row-span-2 grid grid-cols-2 grid-rows-2 gap-4 min-h-0">
                {/* ECG */}
                <div className="bg-white rounded-md p-4 flex flex-col min-h-0">
                    <div className="w-full flex flex-row items-center gap-4 text-left text-lg text-black font-black">
                        <HeartIcon/>
                        <p>Heart Rate</p>
                        <div
                            className="ml-auto bg-teal-800 px-4 py-2 rounded-xl flex flex-row justify-center items-center text-sm gap-2 text-white">
                            <HeartPulseIcon/>
                            <p>{bpm} BPM</p>
                        </div>
                    </div>
                    <div className="border-teal-700 border-2 rounded-md mt-3 p-2 flex-1 min-h-0">
                        {/* @ts-expect-error hell nah dawg */}
                        <Line data={ecg_data}/>
                    </div>
                </div>

                {/* EDA */}
                <div className="bg-white rounded-md p-4 flex flex-col min-h-0">
                    <div className="w-full flex flex-row items-center gap-4 text-left text-lg text-black font-black">
                        <BandageIcon/>
                        <p>Electrodermal Activity</p>
                        <div
                            className="ml-auto bg-teal-800 px-4 py-2 rounded-xl flex flex-row justify-center items-center text-sm gap-2 text-white">
                            <OmegaIcon/>
                            <p>{latestEda !== null ? Number(latestEda).toFixed(2) : '--'} kOhms</p>
                        </div>
                    </div>
                    <div className="border-teal-700 border-2 rounded-md mt-3 p-2 flex-1 min-h-0">
                        {/* @ts-expect-error hell nah dawg */}
                        <Line data={eda_data}/>
                    </div>
                </div>

                {/* Cortisol */}
                <div className="bg-white rounded-md p-4 flex flex-col min-h-0">
                    <div className="w-full flex flex-row items-center gap-4 text-left text-lg text-black font-black">
                        <ActivityIcon/>
                        <p>Cortisol Levels</p>
                        <div
                            className="ml-auto bg-teal-800 px-4 py-2 rounded-xl flex flex-row justify-center items-center text-sm gap-2 text-white">
                            <BrainIcon/>
                            <p>{latestCort?.toString() ?? "..."} ng / mL</p>
                        </div>
                    </div>
                    <div className="border-teal-700 border-2 rounded-md mt-3 p-2 flex-1 min-h-0">
                        {/* @ts-expect-error hell nah dawg */}
                        <Line data={crt_data}/>
                    </div>
                </div>

                {/* Temperature */}
                <div className="bg-white rounded-md p-4 flex flex-col min-h-0">
                    <div className="w-full flex flex-row items-center gap-4 text-left text-lg text-black font-black">
                        <ThermometerIcon/>
                        <p>Temperature</p>
                        <div
                            className="ml-auto bg-teal-800 px-4 py-2 rounded-xl flex flex-row justify-center items-center text-sm gap-2 text-white">
                            <ThermometerSunIcon/>
                            <p>{latestTemp !== null ? Number(latestTemp).toFixed(2) : '--'} °C</p>
                        </div>
                    </div>
                    <div className="border-teal-700 border-2 rounded-md mt-3 p-2 flex-1 min-h-0">
                        {/* @ts-expect-error hell nah dawg */}
                        <Line data={temp_data}/>
                    </div>
                </div>
            </div>
        </div>
    );
}