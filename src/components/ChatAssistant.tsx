import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Terminal, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Fingerprint, 
  X, 
  Code, 
  Info,
  Play,
  RotateCcw,
  Check,
  Radio,
  Sliders,
  Smartphone
} from "lucide-react";
import { ChatMessage, DeviceState, ExecutionLog, ActionPreviewItem } from "../types";
import { androidBridge } from "../services/androidBridge";
import { ALLOWLISTED_TOOLS } from "../data/allowlistedTools";
import { voiceInputManager } from "../services/voiceInput";

interface ChatAssistantProps {
  deviceState: DeviceState;
  setDeviceState: React.Dispatch<React.SetStateAction<DeviceState>>;
  addLog: (log: Omit<ExecutionLog, "id" | "timestamp">) => void;
  setLastActionMessage: (msg: string) => void;
}

const PRESET_PROMPTS = [
  {
    label: "🌙 Screen blinding in bed",
    text: "My screen is blinding me in bed, please dim brightness to 15 percent.",
  },
  {
    label: "🔋 Low battery crisis",
    text: "My battery is dying fast. Turn on battery saver and dim brightness to 20.",
  },
  {
    label: "📶 Wi-Fi Settings",
    text: "Open Wi-Fi settings to check internet networks.",
  },
  {
    label: "⚡ Clear App Cache",
    text: "Clean application cache to free up storage space.",
  },
  {
    label: "🔇 Quiet in library",
    text: "Set audio volume to 0 percent, I am studying in the library.",
  },
  {
    label: "🔦 Pitch Dark Flashlight",
    text: "It is pitch dark here, turn on the flashlight torch.",
  },
];

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  deviceState,
  setDeviceState,
  addLog,
  setLastActionMessage,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-init",
      sender: "assistant",
      text: "Hello! I am your Android AI Automation Assistant. Tell me what issue you're facing in plain English or Bengali. Rule: AI decides WHAT → Android validates WHETHER/HOW → Android executes the allowed action.",
      timestamp: "Ready",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Active Confirmation State
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    tool: string;
    arguments: Record<string, any>;
    preview: ActionPreviewItem;
    messageId: string;
  } | null>(null);

  // Check voice provider availability
  useEffect(() => {
    setSpeechSupported(voiceInputManager.isVoiceSupported());
  }, []);

  const toggleVoiceRecording = () => {
    const activeProvider = voiceInputManager.getActiveProvider();

    if (isListening) {
      if (activeProvider) {
        activeProvider.stopListening();
      }
      setIsListening(false);
    } else {
      if (activeProvider) {
        setIsListening(true);
        activeProvider.startListening(
          (result) => {
            setInputValue(result.transcript);
            if (result.isFinal) {
              setIsListening(false);
              // Voice input feeds into the exact same validated pipeline
              handleSendMessage(result.transcript);
            }
          },
          (error) => {
            console.warn("Voice input warning:", error);
            setIsListening(false);
          },
          () => {
            setIsListening(false);
          }
        );
      } else {
        // Fallback simulation for environments without microphone access
        setIsListening(true);
        setTimeout(() => {
          setIsListening(false);
          const sample = "My screen is blinding me in bed, please dim brightness to 15 percent.";
          setInputValue(sample);
          handleSendMessage(sample);
        }, 1200);
      }
    }
  };

  /**
   * Pipeline step: Execute via Android Bridge & log result
   */
  const executeValidatedAction = async (
    tool: string,
    args: Record<string, any>,
    messageId: string
  ) => {
    const startTime = performance.now();
    const isBridgeReal = androidBridge.isBridgeAvailable();
    const toolDef = ALLOWLISTED_TOOLS[tool];

    // 1. Android Bridge Execution
    const result = await androidBridge.execute(
      tool,
      args,
      deviceState,
      setDeviceState
    );

    const duration = Math.round(performance.now() - startTime + 50);

    // 2. Report Result to Server Audit Pipeline
    try {
      await fetch("/api/device/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: `act-${Date.now()}`,
          tool,
          success: result.success,
          message: result.message,
          source: result.source,
          errorCode: result.errorCode,
        }),
      });
    } catch (e) {
      // Non-blocking log sync
    }

    // 3. Add to Execution Terminal Log
    addLog({
      engine: isBridgeReal ? "ANDROID_BRIDGE" : "SIMULATOR",
      command: `Bridge.execute("${tool}", ${JSON.stringify(args)})`,
      status: result.success ? "SUCCESS" : "FAILED",
      details: result.message + (result.source === "simulator" ? " [Simulation only — no real device change]" : ""),
      durationMs: duration,
    });

    setLastActionMessage(result.message);

    // 4. Update Chat Message UI
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              executionStatus: result.success ? "completed" : "failed",
              source: result.source,
            }
          : m
      )
    );
  };

  /**
   * Main Pipeline Handler:
   * User Request -> AI Planner -> Action Validator -> Confirmation Gate -> Android Bridge Execution
   */
  const handleSendMessage = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Step 1: Request AI Plan from backend (POST /api/ai/plan)
      const planRes = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const planData = await planRes.json();
      const plannedTool: string = planData.tool || "get_device_info";
      const plannedArgs: Record<string, any> = planData.arguments || {};
      const toolDef = ALLOWLISTED_TOOLS[plannedTool] || ALLOWLISTED_TOOLS["get_device_info"];

      // Step 2: Validate Action through ActionValidator (POST /api/actions/validate)
      const valRes = await fetch("/api/actions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: plannedTool, arguments: plannedArgs }),
      });

      const valData = await valRes.json();

      if (!valData.valid) {
        // Validation rejection
        const assistantMessageId = `asst-rejected-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            sender: "assistant",
            text: `Action rejected by Security Validator: ${valData.error}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            executionStatus: "failed",
          },
        ]);
        return;
      }

      // Action is valid - construct preview
      const preview: ActionPreviewItem = {
        id: `prev-${Date.now()}`,
        tool: plannedTool,
        displayName: toolDef.displayName,
        arguments: valData.arguments,
        description: toolDef.description,
        requiredPermission: valData.requiredPermission || "none",
        riskLevel: valData.riskLevel,
        requiresConfirmation: valData.requiresConfirmation,
        androidContract: valData.androidContract,
      };

      const assistantMessageId = `asst-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMessageId,
        sender: "assistant",
        text: planData.explanation || `Structured action: ${toolDef.displayName}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionPreview: preview,
        executionStatus: valData.requiresConfirmation ? "pending" : "completed",
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Step 3: Handle Confirmation requirement
      if (valData.requiresConfirmation) {
        setPendingConfirmation({
          tool: plannedTool,
          arguments: valData.arguments,
          preview,
          messageId: assistantMessageId,
        });
      } else {
        // Safe tool - auto-execute via Bridge
        await executeValidatedAction(plannedTool, valData.arguments, assistantMessageId);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "system",
          text: `Automation error: ${err.message || "Failed to reach AI planner."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllowAction = () => {
    if (!pendingConfirmation) return;
    const { tool, arguments: args, messageId } = pendingConfirmation;
    setPendingConfirmation(null);
    executeValidatedAction(tool, args, messageId);
  };

  const handleCancelAction = () => {
    if (!pendingConfirmation) return;
    const { messageId, tool } = pendingConfirmation;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, executionStatus: "cancelled" } : m))
    );
    addLog({
      engine: androidBridge.isBridgeAvailable() ? "ANDROID_BRIDGE" : "SIMULATOR",
      command: `CANCELLED: ${tool}`,
      status: "BLOCKED",
      details: "User cancelled confirmation gate for action.",
      durationMs: 10,
    });
    setPendingConfirmation(null);
  };

  const isBridgeReal = androidBridge.isBridgeAvailable();

  return (
    <div className="flex flex-col h-[680px] bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl relative">
      
      {/* Header with Mode & Status */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center space-x-1.5 sm:space-x-2">
              <span>Android AI Assistant</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Allowlist v1.0
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {isBridgeReal ? "Direct Native APK Bridge" : "Simulation only — no real device change"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            isBridgeReal 
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}>
            {isBridgeReal ? "REAL DEVICE" : "SIMULATOR"}
          </span>
        </div>
      </div>

      {/* Preset Problem Chips */}
      <div className="px-3 sm:px-4 py-2 bg-slate-950/30 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">
          Quick Issues:
        </span>
        {PRESET_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p.text)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-emerald-950/40 hover:border-emerald-500/40 border border-slate-700/60 text-[11px] text-slate-300 hover:text-emerald-300 whitespace-nowrap transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3 sm:p-3.5 text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-emerald-600 text-slate-950 font-medium rounded-tr-none shadow-md shadow-emerald-600/10"
                  : msg.sender === "system"
                  ? "bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-tl-none"
                  : "bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-tl-none"
              }`}
            >
              <div className="flex items-center justify-between space-x-4 mb-1 text-[10px] opacity-70">
                <span className="font-semibold uppercase tracking-wider">
                  {msg.sender === "user" ? "You" : msg.sender === "assistant" ? "AI Automation Planner" : "Security Gateway"}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              <p className="text-xs">{msg.text}</p>

              {/* Action Preview Card */}
              {msg.actionPreview && (
                <div className="mt-3 space-y-2.5 border-t border-slate-700/50 pt-2.5">
                  <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-mono text-[11px] text-cyan-300 font-semibold">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{msg.actionPreview.tool}()</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          msg.actionPreview.riskLevel === "LOW"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {msg.actionPreview.riskLevel === "LOW" ? "Low Risk (Allowed)" : "Requires Confirmation"}
                      </span>
                    </div>

                    {/* Parameters Schema Preview */}
                    <div className="text-[11px] text-slate-300 bg-slate-900/90 p-2 rounded-lg font-mono">
                      <span className="text-slate-500">arguments: </span>
                      {JSON.stringify(msg.actionPreview.arguments)}
                    </div>

                    {/* Android Native Contract Information */}
                    {msg.actionPreview.androidContract && (
                      <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500">Android API:</span>
                          <span className="font-mono text-emerald-400/90 text-right truncate max-w-[220px]" title={msg.actionPreview.androidContract.nativeApi}>
                            {msg.actionPreview.androidContract.nativeApi}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Permission:</span>
                          <span className="font-mono text-slate-300">
                            {msg.actionPreview.requiredPermission}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Execution Pipeline Status Badge */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/80 text-[10px]">
                      <div className="flex items-center space-x-1">
                        {msg.executionStatus === "completed" ? (
                          <span className="text-emerald-400 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>✓ Action completed</span>
                          </span>
                        ) : msg.executionStatus === "cancelled" ? (
                          <span className="text-rose-400 flex items-center space-x-1">
                            <X className="w-3.5 h-3.5" />
                            <span>✕ Action cancelled</span>
                          </span>
                        ) : msg.executionStatus === "failed" ? (
                          <span className="text-rose-400 flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>✕ Action failed</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Awaiting Confirmation</span>
                          </span>
                        )}
                      </div>

                      <span className="text-slate-400 font-mono text-[9px]">
                        {msg.source === "android" ? "Source: Real Android" : "Source: Web Simulator"}
                      </span>
                    </div>

                    {msg.source === "simulator" && msg.executionStatus === "completed" && (
                      <p className="text-[10px] text-cyan-400 font-mono bg-cyan-950/30 p-1.5 rounded border border-cyan-800/30">
                        Simulation only — no real device change.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
            <span className="font-mono text-[11px]">AI Planner resolving allowlisted tool...</span>
          </div>
        )}
      </div>

      {/* Confirmation UI Modal */}
      {pendingConfirmation && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
                <h4 className="font-semibold text-sm text-slate-100">Action requested</h4>
              </div>
              <button
                onClick={handleCancelAction}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Tool:</span>
                <span className="font-mono text-cyan-400 font-semibold">{pendingConfirmation.tool}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Parameters:</span>
                <span className="font-mono text-slate-200">{JSON.stringify(pendingConfirmation.arguments)}</span>
              </div>
              <p className="text-slate-300 text-[11px] pt-1.5 border-t border-slate-800">
                {pendingConfirmation.preview.description}
              </p>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Rule: <span className="text-slate-300 font-mono">AI decides WHAT → Android validates WHETHER/HOW → Android executes.</span> Confirm below to dispatch to Android Bridge.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={handleCancelAction}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAllowAction}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4 font-bold" />
                <span>Allow</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Input & Text Submission Bar */}
      <div className="p-3 bg-slate-950/70 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center space-x-2"
        >
          <button
            type="button"
            onClick={toggleVoiceRecording}
            className={`p-2.5 rounded-xl border transition-all ${
              isListening
                ? "bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse ring-2 ring-rose-500/30"
                : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
            }`}
            title={speechSupported ? "Tap for voice input (Speech-to-Text)" : "Voice input simulation"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tell me what issue to automate (e.g., 'brightness 70% koro')..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold transition-all shadow-md shadow-emerald-500/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
