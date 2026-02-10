"use client";

import React, { useEffect, useState } from "react";
import { Activity, Brain, Zap, Users, Radio, Terminal, Send } from "lucide-react";

interface AgentStatus {
    state: string; // "idle", "planning", "working", "reflecting"
    roi_score: number;
    interests: string[];
    mood: string;
    recent_logs: string[];
}

interface Props {
    className?: string;
}

const LiveAgentPanel: React.FC<Props> = ({ className = "" }) => {
    const [status, setStatus] = useState<AgentStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [triggerInput, setTriggerInput] = useState("");
    const [isTriggering, setIsTriggering] = useState(false);

    const fetchStatus = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/agent/status");
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error("Failed to fetch agent status:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleManualTrigger = async () => {
        if (!triggerInput.trim()) return;
        setIsTriggering(true);
        try {
            await fetch("http://localhost:8000/demo/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trend: triggerInput })
            });
            setTriggerInput("");
            fetchStatus(); // Refresh immediately
        } catch (e) {
            console.error("Trigger failed", e);
        } finally {
            setIsTriggering(false);
        }
    };

    if (loading && !status) return <div className="p-4 text-white/50 animate-pulse">Connecting to Neural Core...</div>;

    // Gauge calculations
    const score = status?.roi_score || 0;
    const percentage = (score / 10) * 100;
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const getScoreColor = (s: number) => {
        if (s >= 8) return "#10b981"; // Emerald
        if (s >= 5) return "#f59e0b"; // Amber
        return "#ef4444"; // Red
    };

    const isThinking = status?.state === "planning" || status?.state === "reflecting";

    return (
        <div className={`flex flex-col gap-6 text-white ${className}`}>

            {/* Header / Status Indicator */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Radio className={`w-5 h-5 ${isThinking ? 'text-purple-400 animate-pulse' : 'text-green-400'}`} />
                    <h3 className="font-bold text-lg tracking-tight">Live Agent Intelligence</h3>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wider border ${isThinking
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 animate-pulse'
                        : 'bg-green-500/20 border-green-500/30 text-green-400'
                    }`}>
                    {status?.state}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4">

                {/* Viral Potential Gauge */}
                <div className="bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs text-white/50 uppercase tracking-widest mb-3 z-10">Viral Potential</span>
                    <div className="relative w-24 h-24 flex items-center justify-center z-10">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" />
                            <circle cx="48" cy="48" r="40" stroke={getScoreColor(score)} strokeWidth="8" fill="transparent"
                                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                                className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black">{score.toFixed(1)}</span>
                            <Zap className={`w-4 h-4 ${score >= 8 ? 'text-green-400 fill-green-400' : 'text-white/20'}`} />
                        </div>
                    </div>
                </div>

                {/* Context & Mood */}
                <div className="flex flex-col gap-3">
                    <div className="bg-white/5 rounded-xl p-3 flex-1 flex flex-col justify-center">
                        <span className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                            <Users className="w-3 h-3" /> Audience Mood
                        </span>
                        <div className="text-lg font-medium text-blue-200">
                            {status?.mood || "Calibrating..."}
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 flex-1">
                        <span className="text-xs text-white/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Brain className="w-3 h-3" /> Active Interests
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {status?.interests.slice(0, 4).map((interest, i) => (
                                <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/90">
                                    {interest}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Manual Trigger */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <h4 className="text-xs font-semibold text-white/70 uppercase mb-3 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-400" /> Simulate Viral Trend
                </h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={triggerInput}
                        onChange={(e) => setTriggerInput(e.target.value)}
                        placeholder="E.g., 'Retro-futurism is back...'"
                        className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 flex-1 placeholder:text-white/20"
                    />
                    <button
                        onClick={handleManualTrigger}
                        disabled={isTriggering || !triggerInput}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Live Logs */}
            <div className="flex-1 bg-black/40 rounded-xl p-4 border border-white/5 overflow-hidden flex flex-col min-h-[150px]">
                <div className="flex items-center gap-2 mb-3 text-white/40 pb-2 border-b border-white/5">
                    <Terminal className="w-3 h-3" />
                    <span className="text-xs uppercase font-mono">Neural Logs</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs text-white/70 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {status?.recent_logs.map((log, index) => (
                        <div key={index} className="break-words leading-snug border-l-2 border-white/10 pl-2 py-0.5 animate-fade-in-up">
                            <span className="text-[10px] text-white/30 block mb-0.5">{log.split("]")[0].replace("[", "")}</span>
                            <span className={log.includes("VEO_VIDEO") ? "text-purple-300 font-bold" : (log.includes("INJECTED") ? "text-yellow-300" : "text-white/80")}>
                                {log.split("]")[1]?.trim() || log}
                            </span>
                        </div>
                    ))}
                    {(!status?.recent_logs || status.recent_logs.length === 0) && (
                        <div className="text-white/30 italic text-center mt-4">Waiting for agent activity...</div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default LiveAgentPanel;
