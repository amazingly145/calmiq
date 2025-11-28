"use client";

import React, {useEffect, useMemo, useState} from "react";
import {getPollingConfig, setPollingConfig, subscribePollingConfig, type PollingConfig} from "@/functions/firebase";

export default function Topbar() {
    const [enabled, setEnabled] = useState<boolean>(false);
    const [seconds, setSeconds] = useState<number>(10);

    // Keep local controls in sync with global polling config
    useEffect(() => {
        const unsub = subscribePollingConfig((cfg) => {
            setEnabled(cfg.enabled);
            setSeconds(Math.max(1, Math.round(cfg.intervalMs / 1000)));
        });
        // Initialize from current config
        const cfg = getPollingConfig();
        setEnabled(cfg.enabled);
        setSeconds(Math.max(1, Math.round(cfg.intervalMs / 1000)));
        return unsub;
    }, []);

    const intervalMs = useMemo(() => Math.max(1000, Math.round(seconds) * 1000), [seconds]);

    const onToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.checked;
        setEnabled(next);
        setPollingConfig({ enabled: next });
    };

    const onSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (Number.isFinite(val)) {
            setSeconds(val);
        }
    };

    const applyInterval = () => {
        setPollingConfig({ intervalMs });
    };

    return (
        <div className="flex flex-row items-center justify-between w-full h-full bg-gray-100 rounded-md px-4 py-2 text-black">
            <div className="font-bold">CalmIQ Dashboard</div>
            <div className="flex flex-row items-center gap-3">
                <label className="flex items-center gap-2 select-none">
                    <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-600"
                        checked={enabled}
                        onChange={onToggle}
                    />
                    <span>Auto-refresh</span>
                </label>
                <div className="flex items-center gap-2">
                    <label htmlFor="poll-interval" className="text-sm opacity-80">Interval</label>
                    <input
                        id="poll-interval"
                        type="number"
                        min={1}
                        step={1}
                        value={seconds}
                        onChange={onSecondsChange}
                        onBlur={applyInterval}
                        className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    />
                    <span className="text-sm">sec</span>
                </div>
            </div>
        </div>
    );
}
