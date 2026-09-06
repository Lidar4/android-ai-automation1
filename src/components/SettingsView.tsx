import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Cpu,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  Server,
  Activity,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusData, setStatusData] = useState<{
    provider: string;
    model: string;
    geminiConfigured: boolean;
    geminiStatus: "Configured" | "Not Configured" | "Connection Failed";
    environmentVariable: string;
    fallbackActive: boolean;
  } | null>(null);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    timestamp?: string;
  } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/status");
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (e) {
      console.error("Failed to fetch settings status", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult({
        success: !!data.success,
        message: data.message,
        latencyMs: data.latencyMs,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (!data.success && statusData) {
        setStatusData({ ...statusData, geminiStatus: "Connection Failed" });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || "Network error while testing connection.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>AI Provider & Backend Configuration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Server-side environment configuration, connection tests, and security isolation.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium self-start transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Main Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Gemini API Status Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Gemini API Status</h3>
                <span className="text-[11px] text-slate-400">Default Intelligence Engine</span>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 border ${
                statusData?.geminiStatus === "Configured"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : statusData?.geminiStatus === "Connection Failed"
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
              }`}
            >
              {statusData?.geminiStatus === "Configured" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configured</span>
                </>
              ) : statusData?.geminiStatus === "Connection Failed" ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Connection Failed</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Not Configured</span>
                </>
              )}
            </span>
          </div>

          <div className="space-y-2.5 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Provider:</span>
              <span className="font-semibold text-slate-200 uppercase tracking-wider">
                Google Gemini
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Model:</span>
              <span className="font-mono text-cyan-300 font-medium">
                {statusData?.model || "gemini-3.8-flash"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Environment Variable:</span>
              <span className="font-mono text-slate-300">GEMINI_API_KEY</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Client Exposure:</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>Zero Exposure (100% Server-Side)</span>
              </span>
            </div>
          </div>

          {/* Connection Test Action */}
          <div className="pt-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
            >
              <Activity className={`w-4 h-4 ${testing ? "animate-pulse" : ""}`} />
              <span>{testing ? "Testing Connection..." : "Test Gemini Connection"}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 animate-fadeIn ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>{testResult.success ? "✓ Test Passed" : "✕ Test Failed"}</span>
                {testResult.latencyMs !== undefined && (
                  <span className="text-[10px] font-mono opacity-80">{testResult.latencyMs} ms</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Security & Isolation Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Zero-Leak Security Model</h3>
              <span className="text-[11px] text-slate-400">Hardened architecture guarantees</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <p>
                <strong>No API Keys in Web Client or APK:</strong> The Gemini API key is never bundled into JavaScript, never sent to the browser, and never bundled in the Android APK.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <p>
                <strong>Server-Side Only:</strong> All model calls originate from the Express backend via encrypted HTTPS to Google AI Studio.
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <p>
                <strong>Strict Allowlist Boundary:</strong> The AI model output is restricted to standard function calls. Arbitrary shell, ADB, or root commands are rejected at schema validation.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-[11px] flex items-center justify-between">
            <span>Fallback Engine:</span>
            <span className="font-semibold text-cyan-200">Safe Rule-Based Planner Ready</span>
          </div>
        </div>

      </div>

      {/* Guide: Where & How to Configure GEMINI_API_KEY */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>How to Configure & Rotate GEMINI_API_KEY</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold">
              STEP 1: Get Key
            </span>
            <p className="text-slate-300 font-medium">Obtain key from Google AI Studio</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Visit Google AI Studio (<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline inline-flex items-center">aistudio.google.com <ExternalLink className="w-2.5 h-2.5 ml-0.5" /></a>) and generate a new Gemini API Key.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-mono text-[10px] font-bold">
              STEP 2: Set Secret
            </span>
            <p className="text-slate-300 font-medium">Store as server environment variable</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              In Google AI Studio / Cloud Run, add <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">GEMINI_API_KEY</code> under Secrets/Environment settings, or set it in your deployment container environment.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 font-mono text-[10px] font-bold">
              STEP 3: Verify & Rotate
            </span>
            <p className="text-slate-300 font-medium">Test & seamless rotation</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Click "Test Gemini Connection" above to verify the backend can reach Gemini. To rotate, simply update the secret value and restart the container without rebuilding the client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
