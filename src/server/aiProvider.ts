import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ALLOWLISTED_TOOLS_REGISTRY } from "./actionValidator";

export const defaultFunctionDeclarations: FunctionDeclaration[] = Object.values(ALLOWLISTED_TOOLS_REGISTRY).map(
  (tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.entries(tool.parameters.properties).reduce((acc, [key, prop]) => {
        let propType = Type.STRING;
        if (prop.type === "integer") propType = Type.INTEGER;
        else if (prop.type === "boolean") propType = Type.BOOLEAN;
        else if (prop.type === "number") propType = Type.NUMBER;

        acc[key] = {
          type: propType,
          description: prop.description,
        };
        return acc;
      }, {} as Record<string, any>),
      required: tool.parameters.required,
    },
  })
);

/**
 * AI Action Format required by the system:
 * AI decides WHAT.
 * Validator decides WHETHER/HOW.
 * Android executes only approved actions.
 */
export interface AIStructuredPlan {
  tool: string;
  arguments: Record<string, any>;
  requires_confirmation: boolean;
  reason: string;
}

export interface AIProviderResult {
  plan: AIStructuredPlan;
  source: string;
  model: string;
  notice?: string;
  error?: string;
  errorCode?: string;
}

export interface AIPlannerProvider {
  name: string;
  isConfigured: () => boolean;
  planAction: (userMessage: string, toolDeclarations: FunctionDeclaration[]) => Promise<AIProviderResult>;
  testConnection: () => Promise<{ success: boolean; message: string; latencyMs: number }>;
}

/**
 * Rule-based fallback planner when no external AI key is present,
 * or when rate limits / service degradation occur.
 */
export class RuleBasedFallbackProvider implements AIPlannerProvider {
  public name = "RuleBasedFallback";

  public isConfigured(): boolean {
    return true;
  }

  public async planAction(userMessage: string): Promise<AIProviderResult> {
    const p = userMessage.toLowerCase().trim();

    if (p.includes("bright") || p.includes("light") || p.includes("dim") || p.includes("screen")) {
      const match = p.match(/\b([1-9]|[1-9][0-9]|100)\b/);
      const lvl = match ? parseInt(match[1], 10) : p.includes("dim") || p.includes("bed") ? 20 : 70;
      return {
        plan: {
          tool: "set_brightness",
          arguments: { level: Math.min(100, Math.max(1, lvl)) },
          requires_confirmation: false,
          reason: `User requested brightness adjustment to ${lvl}%.`,
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("wifi") || p.includes("wi-fi") || p.includes("internet")) {
      return {
        plan: {
          tool: "open_wifi_settings",
          arguments: {},
          requires_confirmation: false,
          reason: "User requested Wi-Fi settings to configure network.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("bluetooth") || p.includes("pair") || p.includes("headphone") || p.includes("earbuds")) {
      return {
        plan: {
          tool: "open_bluetooth_settings",
          arguments: {},
          requires_confirmation: false,
          reason: "User requested Bluetooth settings to pair or manage devices.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("volume") || p.includes("sound") || p.includes("audio") || p.includes("quiet") || p.includes("loud")) {
      const match = p.match(/\b([0-9]|[1-9][0-9]|100)\b/);
      const lvl = match ? parseInt(match[1], 10) : p.includes("quiet") || p.includes("mute") || p.includes("library") ? 0 : 50;
      return {
        plan: {
          tool: "set_volume",
          arguments: { level: Math.min(100, Math.max(0, lvl)), stream_type: "music" },
          requires_confirmation: false,
          reason: `User requested audio volume level to be set to ${lvl}%.`,
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("flashlight") || p.includes("torch") || p.includes("dark")) {
      const turnOff = p.includes("off") || p.includes("stop");
      return {
        plan: {
          tool: "toggle_flashlight",
          arguments: { enabled: !turnOff },
          requires_confirmation: false,
          reason: `User requested flashlight torch ${!turnOff ? "ON" : "OFF"}.`,
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("battery saver") || p.includes("power saver") || p.includes("conserve")) {
      const turnOff = p.includes("off");
      return {
        plan: {
          tool: "toggle_battery_saver",
          arguments: { enabled: !turnOff },
          requires_confirmation: false,
          reason: "User requested Battery Saver settings to manage power.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("dnd") || p.includes("disturb") || p.includes("silence") || p.includes("do not disturb")) {
      const turnOff = p.includes("off");
      return {
        plan: {
          tool: "toggle_do_not_disturb",
          arguments: { enabled: !turnOff },
          requires_confirmation: true,
          reason: `User requested Do Not Disturb mode ${!turnOff ? "ON" : "OFF"}.`,
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("cache") || p.includes("storage") || p.includes("lag") || p.includes("slow") || p.includes("clean")) {
      return {
        plan: {
          tool: "clear_own_cache",
          arguments: {},
          requires_confirmation: true,
          reason: "User requested cache clearance to resolve storage or performance issues.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("battery") || p.includes("charge") || p.includes("level")) {
      return {
        plan: {
          tool: "get_battery_status",
          arguments: {},
          requires_confirmation: false,
          reason: "User requested battery charge status and capacity.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("network") || p.includes("signal") || p.includes("cellular") || p.includes("connection")) {
      return {
        plan: {
          tool: "get_network_status",
          arguments: {},
          requires_confirmation: false,
          reason: "User requested active network reachability inspection.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    if (p.includes("app settings") || p.includes("permissions") || p.includes("manage app")) {
      return {
        plan: {
          tool: "open_app_settings",
          arguments: {},
          requires_confirmation: false,
          reason: "User requested application details in system settings.",
        },
        source: "fallback_rule_engine",
        model: "rule-v1",
      };
    }

    // Default safe diagnostics
    return {
      plan: {
        tool: "get_device_info",
        arguments: {},
        requires_confirmation: false,
        reason: "User requested device system specifications.",
      },
      source: "fallback_rule_engine",
      model: "rule-v1",
    };
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    return {
      success: true,
      message: "Fallback rule planner active.",
      latencyMs: 1,
    };
  }
}

/**
 * Google Gemini Provider using modern @google/genai TypeScript SDK.
 * Reads GEMINI_API_KEY from server-side environment variable only.
 */
export class GeminiPlannerProvider implements AIPlannerProvider {
  public name = "Google Gemini";
  private client: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  }

  public isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  }

  private getClient(): GoogleGenAI | null {
    if (!this.client && this.isConfigured()) {
      this.client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return this.client;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async planAction(userMessage: string, toolDeclarations?: FunctionDeclaration[]): Promise<AIProviderResult> {
    const ai = this.getClient();
    if (!ai) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }

    const declarations =
      toolDeclarations && toolDeclarations.length > 0
        ? toolDeclarations
        : defaultFunctionDeclarations;

    const systemInstruction = `You are the Android AI Automation Assistant Planner.
CRITICAL SECURITY RULES:
1. "AI decides WHAT -> Android validates WHETHER/HOW -> Android executes allowed action."
2. You must NEVER formulate shell commands, bash strings, ADB, root exec, or arbitrary file access.
3. You must ONLY call one of the provided allowlisted functions with typed arguments.
4. Output a function call matching the user's intent. If the user asks about an issue with no toggle, use the nearest 'open_*_settings' tool.`;

    const candidateModels = [
      this.modelName,
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;

    for (const modelToTry of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelToTry,
            contents: userMessage,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: declarations }],
              temperature: 0.1,
            },
          });

          const parts = (response.candidates?.[0]?.content?.parts || []) as any[];
          const functionCalls: any[] = [];

          if (Array.isArray(response.functionCalls) && response.functionCalls.length > 0) {
            functionCalls.push(...response.functionCalls);
          } else {
            for (const part of parts) {
              if (part.functionCall) {
                functionCalls.push(part.functionCall);
              }
            }
          }

          if (functionCalls.length > 0) {
            const call = functionCalls[0];
            return {
              plan: {
                tool: call.name,
                arguments: (call.args as Record<string, any>) || {},
                requires_confirmation: call.name === "toggle_do_not_disturb" || call.name === "clear_own_cache",
                reason: `Formulated ${call.name} to address user request.`,
              },
              source: "google_gemini",
              model: modelToTry,
            };
          }
          // If no tool call returned on this model, break inner loop to try next candidate
          break;
        } catch (err: any) {
          lastError = err;
          const errStr = String(err?.message || "");
          const isHighDemandOrUnavailable =
            err?.status === 503 ||
            err?.status === 429 ||
            errStr.includes("503") ||
            errStr.includes("high demand") ||
            errStr.includes("UNAVAILABLE") ||
            errStr.includes("Spikes in demand") ||
            errStr.includes("temporary");

          if (isHighDemandOrUnavailable && attempt < 2) {
            // Short backoff before retry on transient demand spike
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          }
          // Break to next candidate model
          break;
        }
      }
    }

    throw lastError || new Error("NO_TOOL_CALL_RETURNED");
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const ai = this.getClient();
    if (!ai) {
      return {
        success: false,
        message: "GEMINI_API_KEY environment variable is not configured.",
        latencyMs: 0,
      };
    }

    const startTime = Date.now();
    const candidateModels = [
      this.modelName,
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;

    for (const modelToTry of candidateModels) {
      try {
        const res = await ai.models.generateContent({
          model: modelToTry,
          contents: "Respond with the word 'OK'.",
          config: {
            maxOutputTokens: 5,
            temperature: 0.1,
          },
        });
        const latency = Date.now() - startTime;
        return {
          success: true,
          message: `Connection successful (${modelToTry}). Response: ${res.text?.trim() || "OK"}`,
          latencyMs: latency,
        };
      } catch (err: any) {
        lastError = err;
      }
    }

    const latency = Date.now() - startTime;
    let errorMsg = "Failed to connect to Gemini API.";
    if (lastError?.status === 401 || lastError?.message?.includes("API key")) {
      errorMsg = "Authentication failed: Invalid or expired Gemini API key.";
    } else if (lastError?.status === 429 || lastError?.message?.includes("quota")) {
      errorMsg = "Quota exceeded or rate limited.";
    } else if (lastError?.status === 503 || String(lastError?.message || "").includes("503")) {
      errorMsg = "Gemini service temporarily at peak capacity. Engaging automatic local fallback.";
    } else if (lastError?.message) {
      errorMsg = lastError.message;
    }

    return {
      success: false,
      message: errorMsg,
      latencyMs: latency,
    };
  }
}

/**
 * Pluggable AI Model Manager supporting Google Gemini as default,
 * with clean interfaces ready for OpenAI or Anthropic in the future.
 */
export class AIModelManager {
  private geminiProvider: GeminiPlannerProvider;
  private fallbackProvider: RuleBasedFallbackProvider;

  constructor() {
    this.geminiProvider = new GeminiPlannerProvider();
    this.fallbackProvider = new RuleBasedFallbackProvider();
  }

  public getGeminiProvider(): GeminiPlannerProvider {
    return this.geminiProvider;
  }

  public getStatus() {
    const isConfigured = this.geminiProvider.isConfigured();
    return {
      provider: "google",
      model: this.geminiProvider.getModelName(),
      geminiConfigured: isConfigured,
      geminiStatus: isConfigured ? "Configured" : "Not Configured",
      environmentVariable: "GEMINI_API_KEY",
      fallbackActive: !isConfigured,
    };
  }

  public async planAction(
    userMessage: string,
    toolDeclarations: FunctionDeclaration[]
  ): Promise<AIProviderResult> {
    if (this.geminiProvider.isConfigured()) {
      try {
        return await this.geminiProvider.planAction(userMessage, toolDeclarations);
      } catch (err: any) {
        const errStr = typeof err?.message === "string" ? err.message : JSON.stringify(err);
        let cleanReason = "Model demand peak";
        if (errStr.includes("503") || errStr.includes("high demand") || errStr.includes("UNAVAILABLE")) {
          cleanReason = "Gemini experiencing temporary high demand; seamlessly using local engine";
        } else if (errStr.includes("429") || errStr.includes("quota")) {
          cleanReason = "Gemini rate quota reached; seamlessly using local engine";
        }

        console.info(`[Planner Fallback] ${cleanReason}.`);
        const fallbackResult = await this.fallbackProvider.planAction(userMessage);
        return {
          ...fallbackResult,
          notice: cleanReason,
        };
      }
    }

    return await this.fallbackProvider.planAction(userMessage);
  }

  public async testConnection() {
    if (!this.geminiProvider.isConfigured()) {
      return {
        success: false,
        message: "GEMINI_API_KEY is not configured on the server.",
        status: "Not Configured",
        latencyMs: 0,
      };
    }

    const test = await this.geminiProvider.testConnection();
    return {
      ...test,
      status: test.success ? "Configured" : "Connection Failed",
    };
  }
}

export const aiModelManager = new AIModelManager();
