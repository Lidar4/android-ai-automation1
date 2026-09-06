import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Type, FunctionDeclaration } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { aiModelManager } from "./src/server/aiProvider";
import {
  ALLOWLISTED_TOOLS_REGISTRY,
  AllowlistedToolMeta,
  ValidationResult,
  validateAction,
} from "./src/server/actionValidator";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Security Headers & Request Body Limiting
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json({ limit: "256kb" }));

// In-memory sliding window rate limiter (60 req/min per IP on AI planning)
const requestRateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "global";
  const now = Date.now();
  const entry = requestRateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    requestRateMap.set(ip, { count: 1, resetAt: now + 60000 });
    return next();
  }

  if (entry.count >= 60) {
    return res.status(429).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many automation requests. Please wait a moment before trying again.",
    });
  }

  entry.count++;
  next();
}

// Convert allowlisted registry to Gemini FunctionDeclaration format
const geminiFunctionDeclarations: FunctionDeclaration[] = Object.values(ALLOWLISTED_TOOLS_REGISTRY).map(
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

// In-memory Execution Audit Log (Ring buffer, max 100 entries)
interface DeviceAuditEntry {
  actionId: string;
  tool: string;
  arguments?: Record<string, any>;
  success: boolean;
  message: string;
  source: "android" | "simulator";
  errorCode?: string;
  timestamp: string;
}
const deviceAuditLogs: DeviceAuditEntry[] = [
  {
    actionId: "init-001",
    tool: "get_device_info",
    arguments: {},
    success: true,
    message: "System initialized with Allowlisted Tool Registry v1.0",
    source: "simulator",
    timestamp: new Date().toISOString(),
  },
];

// Fallback rule-based planner if Gemini API key is not present or rate-limited
function planFallbackAction(userPrompt: string) {
  const p = userPrompt.toLowerCase();

  if (p.includes("bright") || p.includes("light") || p.includes("আলো") || p.includes("ডিম") || p.includes("screen")) {
    const match = p.match(/\b([1-9]|[1-9][0-9]|100)\b/);
    const lvl = match ? parseInt(match[1], 10) : p.includes("dim") || p.includes("কমা") || p.includes("bed") ? 20 : 70;
    return {
      tool: "set_brightness",
      arguments: { level: lvl },
      explanation: `Configuring display brightness to ${lvl}%.`,
      requiresConfirmation: false,
    };
  }

  if (p.includes("wifi") || p.includes("wi-fi") || p.includes("ওয়াইফাই")) {
    return {
      tool: "open_wifi_settings",
      arguments: {},
      explanation: "Opening Android Wi-Fi configuration panel to manage connections safely.",
      requiresConfirmation: false,
    };
  }

  if (p.includes("bluetooth") || p.includes("ব্লুটুথ")) {
    return {
      tool: "open_bluetooth_settings",
      arguments: {},
      explanation: "Opening Bluetooth settings to pair or disconnect devices.",
      requiresConfirmation: false,
    };
  }

  if (p.includes("volume") || p.includes("sound") || p.includes("শব্দ") || p.includes("আওয়াজ")) {
    return {
      tool: "set_volume",
      arguments: { level: 40, stream_type: "music" },
      explanation: "Adjusting audio volume level to 40%.",
      requiresConfirmation: false,
    };
  }

  if (p.includes("flashlight") || p.includes("টর্চ") || p.includes("torch")) {
    const turnOff = p.includes("off") || p.includes("বন্ধ");
    return {
      tool: "toggle_flashlight",
      arguments: { enabled: !turnOff },
      explanation: `Turning flashlight torch ${!turnOff ? "ON" : "OFF"}.`,
      requiresConfirmation: false,
    };
  }

  if (p.includes("battery saver") || p.includes("power saver") || p.includes("চার্জ কম") || p.includes("ব্যাটারি")) {
    return {
      tool: "toggle_battery_saver",
      arguments: { enabled: true },
      explanation: "Navigating to Battery Saver settings to conserve power.",
      requiresConfirmation: false,
    };
  }

  if (p.includes("dnd") || p.includes("disturb") || p.includes("নীরব") || p.includes("বিরক্ত")) {
    return {
      tool: "toggle_do_not_disturb",
      arguments: { enabled: true },
      explanation: "Setting Do Not Disturb filter to prioritize alarms only.",
      requiresConfirmation: true,
    };
  }

  if (p.includes("cache") || p.includes("ক্যাশ") || p.includes("lag") || p.includes("slow")) {
    return {
      tool: "clear_own_cache",
      arguments: {},
      explanation: "Purging temporary application cache to free up memory.",
      requiresConfirmation: true,
    };
  }

  // Default safe diagnostic
  return {
    tool: "get_device_info",
    arguments: {},
    explanation: "Retrieving device status and operating system specifications.",
    requiresConfirmation: false,
  };
}

// =============================================================
// API ENDPOINTS
// =============================================================

/**
 * 1. POST /api/ai/plan
 * Takes natural language prompt and produces a single structured, allowlisted tool action.
 * Rule: "AI decides WHAT -> Android validates WHETHER/HOW -> Android executes allowed action."
 */
app.post("/api/ai/plan", rateLimiter, async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ success: false, error: "INVALID_REQUEST", message: "Property 'message' must be a non-empty string." });
  }

  try {
    const providerResult = await aiModelManager.planAction(message, geminiFunctionDeclarations);
    const plan = providerResult.plan;
    const validation = validateAction(plan.tool, plan.arguments);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: validation.error || "INVALID_ACTION",
        message: validation.message,
        validation,
      });
    }

    return res.json({
      success: true,
      valid: true,
      tool: plan.tool,
      arguments: validation.arguments,
      requires_confirmation: validation.requiresConfirmation,
      reason: plan.reason,
      explanation: plan.reason,
      riskLevel: validation.riskLevel,
      requiredPermission: validation.requiredPermission,
      androidContract: validation.androidContract,
      source: providerResult.source,
      model: providerResult.model,
      validation,
    });
  } catch (error: any) {
    console.info("AI Planner fallback engaged for query:", String(message || "").slice(0, 50));
    const fallback = planFallbackAction(message);
    const validation = validateAction(fallback.tool, fallback.arguments);

    return res.json({
      success: true,
      valid: validation.valid,
      tool: fallback.tool,
      arguments: validation.arguments,
      requires_confirmation: validation.requiresConfirmation,
      reason: fallback.explanation,
      explanation: fallback.explanation,
      riskLevel: validation.riskLevel,
      requiredPermission: validation.requiredPermission,
      androidContract: validation.androidContract,
      source: "fallback_rule_engine",
      validation,
    });
  }
});

/**
 * 2. POST /api/actions/validate
 * ActionValidator endpoint that checks parameters, ranges, permissions, and security.
 */
app.post("/api/actions/validate", (req, res) => {
  const { tool, arguments: args } = req.body;

  if (!tool || typeof tool !== "string") {
    return res.status(400).json({
      success: false,
      valid: false,
      error: "INVALID_ACTION",
      message: "Tool name must be specified.",
    });
  }

  const result = validateAction(tool, args || {});
  return res.json(result);
});

/**
 * 3. POST /api/device/result
 * Receives execution result from either Android APK Bridge or Web Simulator.
 */
app.post("/api/device/result", (req, res) => {
  const { actionId, tool, success, message, source, errorCode } = req.body;

  const entry: DeviceAuditEntry = {
    actionId: actionId || `act-${Date.now()}`,
    tool: tool || "unknown",
    success: !!success,
    message: message || (success ? "Action completed" : "Action failed"),
    source: source === "android" ? "android" : "simulator",
    errorCode,
    timestamp: new Date().toISOString(),
  };

  deviceAuditLogs.unshift(entry);
  if (deviceAuditLogs.length > 100) deviceAuditLogs.pop();

  return res.json({
    success: true,
    status: "recorded",
    logId: entry.actionId,
    data: {
      status: "recorded",
      logId: entry.actionId,
      entry,
    },
  });
});

/**
 * 4. GET /api/device/status
 * Returns Device Connection Status (CONNECTED, DISCONNECTED, SIMULATOR)
 */
app.get("/api/device/status", (req, res) => {
  const ua = req.headers["user-agent"] || "";
  const isAndroidWebView = /wv|Android.*Version\/[0-9.]+/i.test(ua);

  const statusData = {
    deviceConnected: isAndroidWebView,
    mode: isAndroidWebView ? "REAL_DEVICE" : "SIMULATOR",
    platform: isAndroidWebView ? "Android APK (Native Bridge Available)" : "Web Browser (Simulator Mode)",
    bridgeAvailable: isAndroidWebView,
    allowlistedToolsCount: Object.keys(ALLOWLISTED_TOOLS_REGISTRY).length,
    lastHeartbeat: new Date().toISOString(),
  };

  res.json({
    success: true,
    ...statusData,
    data: statusData,
  });
});

/**
 * 5. GET /api/device/info
 * Returns system specs
 */
app.get("/api/device/info", (req, res) => {
  const infoData = {
    os: "Android 15 (Vanilla Ice Cream) / API 35",
    kernel: "Linux 6.1.75-android15",
    build: "AP4A.241205.013",
    bridgeVersion: "1.0.0-production",
    supportedTools: Object.keys(ALLOWLISTED_TOOLS_REGISTRY),
  };

  res.json({
    success: true,
    ...infoData,
    data: infoData,
  });
});

/**
 * 6. GET /api/health
 * Production health check endpoint.
 * Note: Never returns or leaks API secrets!
 */
app.get("/api/health", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  res.json({
    status: "ok",
    aiProvider: "google",
    geminiConfigured: hasKey,
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    mode: "production-ready",
    allowlistedToolsCount: Object.keys(ALLOWLISTED_TOOLS_REGISTRY).length,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/status
 * Standard system and automation status.
 */
app.get("/api/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  res.json({
    success: true,
    data: {
      status: "online",
      aiProvider: "google",
      geminiConfigured: hasKey,
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      mode: "production-ready",
      allowlistedToolsCount: Object.keys(ALLOWLISTED_TOOLS_REGISTRY).length,
      allowlistedTools: Object.keys(ALLOWLISTED_TOOLS_REGISTRY),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * 7. GET /api/settings/status
 * Status information for UI configuration without leaking secrets.
 */
app.get("/api/settings/status", (req, res) => {
  res.json(aiModelManager.getStatus());
});

/**
 * 8. POST /api/settings/test-connection
 * Tests backend connection to Gemini API safely.
 */
app.post("/api/settings/test-connection", async (req, res) => {
  const result = await aiModelManager.testConnection();
  res.json(result);
});

/**
 * 9. POST /api/chat-automate (Backward compatibility for existing components)
 * Upgraded to use strict allowlist and validation.
 */
app.post("/api/chat-automate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const providerResult = await aiModelManager.planAction(prompt, geminiFunctionDeclarations);
    const plan = providerResult.plan;
    const validation = validateAction(plan.tool, plan.arguments);
    const toolDef = ALLOWLISTED_TOOLS_REGISTRY[plan.tool] || ALLOWLISTED_TOOLS_REGISTRY["get_device_info"];

    return res.json({
      message: plan.reason || `Formulated ${toolDef.displayName} safely.`,
      toolCalls: [
        {
          name: plan.tool,
          args: validation.arguments,
          description: toolDef.description,
          riskTier: validation.riskLevel === "LOW" ? "LOW_SAFE" : "MEDIUM_CONFIRM",
          requiresBiometricOrConfirmation: validation.requiresConfirmation,
          shizukuCommand: `# Native Android API: ${toolDef.androidContract.nativeApi}`,
          accessibilityFallback: toolDef.androidContract.fallbackIntent || "Native Android API",
        },
      ],
      source: providerResult.source,
    });
  } catch (error: any) {
    const fallback = planFallbackAction(prompt);
    const toolDef = ALLOWLISTED_TOOLS_REGISTRY[fallback.tool];
    return res.json({
      message: fallback.explanation,
      toolCalls: [
        {
          name: fallback.tool,
          args: fallback.arguments,
          description: toolDef?.description || fallback.explanation,
          riskTier: "LOW_SAFE",
          requiresBiometricOrConfirmation: false,
          shizukuCommand: `# Native Android API: ${toolDef?.androidContract.nativeApi || fallback.tool}`,
          accessibilityFallback: toolDef?.androidContract.fallbackIntent || "Native Android API",
        },
      ],
      source: "fallback",
    });
  }
});

// Backward compatibility status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    availableToolsCount: Object.keys(ALLOWLISTED_TOOLS_REGISTRY).length,
    supportedRuntimes: ["Android Native APK (Kotlin/WebView)", "Web Simulator"],
    executionEngines: ["Android Native API Bridge", "Web Browser Simulator"],
  });
});

// Vite middleware & Production SPA Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production Android Automation Assistant Server running on http://localhost:${PORT}`);
  });
}

startServer();
