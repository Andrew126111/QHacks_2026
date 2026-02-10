"use client";

import React, { useEffect, useState } from "react";
import { Activity, Terminal, Brain, Zap, Users } from "lucide-react";

interface AgentStatus {
  state: string;
  roi_score: number;
  interests: string[];
  mood: string;
  recent_logs: string[];
}

const AgentStatusWidget = () => {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading && !status) return null;

  // Calculate gauge rotation/percentage
  const score = status?.roi_score || 0;
  const percentage = (score / 10) * 100;
  const circumference = 2 * Math.PI * 40; // r=40
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on score
  const getScoreColor = (s: number) => {
    if (s >= 8) return "#10b981"; // Emerald
    if (s >= 5) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="fixed bottom-8 left-8 z-50 w-80 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl animate-fade-in-up font-sans text-white">
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Agent Core
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${status?.state === 'working' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'
          }`}>
          {status?.state || 'OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Viral Potential Gauge */}
        <div className="flex flex-col items-center justify-center bg-white/5 rounded-lg p-3">
          <span className="text-[10px] text-white/50 uppercase tracking-wide mb-2">Viral Potential</span>
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke={scoreColor}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xl font-bold">{score.toFixed(1)}</span>
              <Zap className="w-3 h-3 text-white/40 mt-0.5" />
            </div>
          </div>
        </div>

        {/* Audience Mood */}
        <div className="flex flex-col gap-2">
          <div className="bg-white/5 rounded-lg p-3 flex-1 flex flex-col justify-center">
            <span className="text-[10px] text-white/50 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Audience Mood
            </span>
            <div className="mt-1 text-lg font-medium text-blue-200">
              {status?.mood || "Unknown"}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 flex-1 flex flex-col justify-center">
            <span className="text-[10px] text-white/50 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Brain className="w-3 h-3" /> Active Interests
            </span>
            <div className="flex flex-wrap gap-1">
              {status?.interests.slice(0, 3).map((interest, i) => (
                <span key={i} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/80">
                  {interest}
                </span>
              ))}
              {(status?.interests.length || 0) > 3 && (
                <span className="text-[10px] text-white/40">+{(status?.interests.length || 0) - 3}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logs Terminal */}
      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
        <div className="flex items-center gap-2 mb-2 text-white/40">
          <Terminal className="w-3 h-3" />
          <span className="text-[10px] uppercase font-mono">System Logs</span>
        </div>
        <div className="h-24 overflow-y-auto space-y-1 font-mono text-[10px] text-white/70 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {status?.recent_logs.map((log, index) => (
            <div key={index} className="break-words leading-tight opacity-80 border-l-2 border-transparent hover:border-white/20 pl-1 transition-colors">
              <span className="text-white/30 mr-1">{log.split("]")[0].replace("[", "")}</span>
              <span className={log.includes("VEO_VIDEO") ? "text-purple-300" : ""}>
                {log.split("]")[1]?.trim() || log}
              </span>
            </div>
          ))}
          {(!status?.recent_logs || status.recent_logs.length === 0) && (
            <div className="text-white/30 italic">No recent activity...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentStatusWidget;
