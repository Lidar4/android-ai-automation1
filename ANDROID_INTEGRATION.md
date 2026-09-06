# Android AI Automation Assistant - Production Integration Guide

This document outlines the complete architectural contract, API specifications, and native Android APK integration requirements for **DroidAutomate AI / Android AI Automation Assistant**.

---

## 1. Architectural Overview

The system strictly enforces the security boundary:
> **"AI decides WHAT → Android validates WHETHER/HOW → Android executes the allowed action."**

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
│               (Voice Audio / Natural Language)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AI Automation Assistant UI                  │
│       (Mobile-First Responsive Web / Android WebView)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend API                         │
│                    (Express / Node.js)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          AI Planner                         │
│            (Gemini 3.8 Flash Function Calling)              │
│       Returns: { tool: string, arguments: object }          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Action Validator                       │
│    (Checks Allowlist, Value Ranges, Security & Confirm)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Android Bridge API                     │
│               window.androidBridge.execute(...)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   [ REAL DEVICE MODE ]                [ SIMULATOR MODE ]
(Inside Android APK WebView)       (Standard Web Browser)
   Calls Native Android API          Updates Visual Simulator
              │                     "Simulation only — no
              ▼                      real device change"
   [ Android Native API ]
- Settings.System.putInt
- AudioManager.setStreamVolume
- CameraManager.setTorchMode
- Settings Panels / Intents
              │
              ▼
   [ Real Device Action ]
```

---

## 2. API Endpoints Specification

### 2.1 `POST /api/ai/plan`
Converts natural language queries into a single structured, allowlisted tool action.

- **Request:**
  ```json
  {
    "message": "brightness 70 percent koro"
  }
  ```
- **Response:**
  ```json
  {
    "tool": "set_brightness",
    "arguments": {
      "level": 70
    },
    "explanation": "Configuring display brightness to 70%.",
    "requiresConfirmation": false,
    "riskLevel": "LOW",
    "validation": {
      "valid": true,
      "tool": "set_brightness",
      "arguments": { "level": 70 },
      "requiredPermission": "android.permission.WRITE_SETTINGS",
      "requiresConfirmation": false,
      "riskLevel": "LOW"
    },
    "source": "gemini-3.8-flash"
  }
  ```

---

### 2.2 `POST /api/actions/validate`
Validates whether a tool invocation is allowed, within acceptable parameter boundaries, and flags required permissions or confirmation gates.

- **Request:**
  ```json
  {
    "tool": "set_brightness",
    "arguments": {
      "level": 70
    }
  }
  ```
- **Response (Valid):**
  ```json
  {
    "valid": true,
    "tool": "set_brightness",
    "arguments": { "level": 70 },
    "requiredPermission": "android.permission.WRITE_SETTINGS",
    "requiresConfirmation": false,
    "riskLevel": "LOW",
    "androidContract": {
      "nativeApi": "Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, (level * 255) / 100)",
      "requiredPermission": "android.permission.WRITE_SETTINGS",
      "minSdkVersion": 21,
      "fallbackIntent": "Intent(Settings.ACTION_DISPLAY_SETTINGS)"
    }
  }
  ```
- **Response (Invalid Range Rejection):**
  ```json
  {
    "valid": false,
    "tool": "set_brightness",
    "arguments": { "level": 500 },
    "error": "Brightness level must be an integer between 1 and 100.",
    "errorCode": "INVALID_ARGUMENT_RANGE",
    "riskLevel": "LOW"
  }
  ```

---

### 2.3 `POST /api/device/result`
Ingests action execution feedback from the Android Companion APK or Web Simulator for security audit logging.

- **Request:**
  ```json
  {
    "actionId": "act-1725600000",
    "tool": "set_brightness",
    "success": true,
    "message": "Brightness changed successfully",
    "source": "android"
  }
  ```
- **Response:**
  ```json
  {
    "status": "recorded",
    "logId": "act-1725600000"
  }
  ```

---

### 2.4 `GET /api/device/status`
Queries current device connection state.
- **Response:**
  ```json
  {
    "deviceConnected": true,
    "mode": "REAL_DEVICE",
    "platform": "Android APK (Native Bridge Available)",
    "bridgeAvailable": true,
    "allowlistedToolsCount": 12,
    "lastHeartbeat": "2026-09-06T17:45:00.000Z"
  }
  ```

---

### 2.5 `GET /api/device/info`
Retrieves sanitized host or simulated device metrics.

---

### 2.6 `GET /api/health`
Health check verifying server status, Gemini readiness, and allowlisted tools registry integrity.

---

## 3. Initial Allowlisted Tools Registry (v1.0)

| Tool Name | Arguments Schema | Required Permission | Risk Level | Confirmation Required | Android Native Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `set_brightness` | `{ level: integer [1..100] }` | `android.permission.WRITE_SETTINGS` | LOW | No | `Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, val)` |
| `open_wifi_settings` | `{}` | None | LOW | No | `Intent(Settings.Panel.ACTION_WIFI)` or `Intent(Settings.ACTION_WIFI_SETTINGS)` |
| `open_bluetooth_settings`| `{}` | None | LOW | No | `Intent(Settings.ACTION_BLUETOOTH_SETTINGS)` |
| `open_app_settings` | `{ package_name?: string }` | None | LOW | No | `Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg))` |
| `set_volume` | `{ level: integer [0..100], stream_type?: string }` | None | LOW | No | `audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, vol, AudioManager.FLAG_SHOW_UI)` |
| `toggle_flashlight` | `{ enabled: boolean }` | `android.permission.CAMERA` | LOW | No | `cameraManager.setTorchMode(cameraId, enabled)` |
| `toggle_battery_saver` | `{ enabled: boolean }` | None | LOW | No | `Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)` |
| `toggle_do_not_disturb` | `{ enabled: boolean }` | `android.permission.ACCESS_NOTIFICATION_POLICY` | MEDIUM | Yes | `notificationManager.setInterruptionFilter(...)` |
| `clear_own_cache` | `{}` | None | MEDIUM | Yes | `context.cacheDir.deleteRecursively()` |
| `get_device_info` | `{}` | None | LOW | No | `Build.MANUFACTURER`, `Build.MODEL`, `Build.VERSION.RELEASE` |
| `get_battery_status` | `{}` | None | LOW | No | `batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)` |
| `get_network_status` | `{}` | `android.permission.ACCESS_NETWORK_STATE` | LOW | No | `connectivityManager.getNetworkCapabilities(...)` |

> ⚠️ **Strict Ban on Arbitrary Execution**:
> No `run_shell`, `adb_shell`, `root_command`, or arbitrary command execution exists. Only the explicit methods in this allowlist can ever be executed.

---

## 4. Android Bridge API Interface

### Logical JavaScript Contract
```typescript
interface AndroidBridge {
  // Dispatches an allowlisted action
  execute(tool: string, jsonArgs: string): string; // returns JSON stringified AndroidBridgeResponse
  isDeviceConnected(): boolean;
  getDeviceInfo(): string;
}
```

### Kotlin Native `@JavascriptInterface` Implementation (in Android APK)
```kotlin
package com.ai.deviceassistant.bridge

import android.app.Activity
import android.webkit.JavascriptInterface
import org.json.JSONObject

class AndroidBridge(
    private val activity: Activity,
    private val executor: DeviceActionExecutor
) {
    @JavascriptInterface
    fun execute(tool: String, jsonArgs: String): String {
        return try {
            val args = JSONObject(jsonArgs)
            val result = executor.executeAction(tool, args)
            result.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("tool", tool)
                put("message", "Bridge execution error: ${e.message}")
                put("errorCode", "BRIDGE_EXECUTION_EXCEPTION")
                put("source", "android")
            }.toString()
        }
    }

    @JavascriptInterface
    fun isDeviceConnected(): Boolean = true

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return JSONObject().apply {
            put("manufacturer", android.os.Build.MANUFACTURER)
            put("model", android.os.Build.MODEL)
            put("androidVersion", android.os.Build.VERSION.RELEASE)
            put("sdkInt", android.os.Build.VERSION.SDK_INT)
        }.toString()
    }
}
```

---

## 5. Web Fallback & Operational Modes

1. **REAL DEVICE MODE (`REAL_DEVICE`)**:
   - Detected when `window.androidBridge` is injected by the host Android WebView.
   - Calls native Android APIs via `@JavascriptInterface`.
   - Results originate from `source: "android"`.

2. **SIMULATOR MODE (`SIMULATOR`)**:
   - Activated when loaded in standard web browsers (desktop, iOS, or non-companion browser).
   - Modifies the interactive on-screen device simulator.
   - **Mandatory Disclaimer**: Every result badge explicitly displays:
     > *"Simulation only — no real device change."*

---

## 6. Android WebView Setup & APK Integration

In `MainActivity.kt`:
```kotlin
val webView = findViewById<WebView>(R.id.webView)
val executor = DeviceActionExecutor(this)

webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    allowFileAccess = false
    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    userAgentString = "${userAgentString} DroidAutomateBridge/1.0"
}

// Bind Javascript Interface
webView.addJavascriptInterface(AndroidBridge(this, executor), "androidBridge")

// Handle Android Back Navigation
onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            finish()
        }
    }
})

webView.loadUrl("https://your-production-app-url.run.app")
```

---

## 7. Implementation Checklist: Web vs Native APK

| Feature Component | Web App Implementation | Native Android APK Implementation |
| :--- | :---: | :---: |
| Natural Language & Voice Intake | ✅ Fully Implemented (Web Speech API) | Native SpeechRecognizer (Optional overlay) |
| AI Planning & Gemini Function Calling | ✅ Fully Implemented (`/api/ai/plan`) | Proxies to Web API backend |
| Action Validation & Schema Checking | ✅ Fully Implemented (`/api/actions/validate`) | Native Security Guard in `DeviceActionExecutor` |
| Confirmation Dialog Modal | ✅ Fully Implemented (Touch UI) | `BiometricPrompt` on Tier-2 Actions |
| Interactive Phone Simulator | ✅ Fully Implemented (Visual SVG/CSS) | N/A (Runs on real hardware) |
| Native `WRITE_SETTINGS` Brightness | N/A (Delegates to Bridge) | 🛠️ Implemented via `DeviceActionExecutor.kt` |
| Native Wi-Fi & Bluetooth Panels | N/A (Delegates to Bridge) | 🛠️ Implemented via `Settings.Panel` Intent |
| Native Camera Torch Mode | N/A (Delegates to Bridge) | 🛠️ Implemented via `CameraManager` |
| Native Audio Volume Adjustment | N/A (Delegates to Bridge) | 🛠️ Implemented via `AudioManager` |
| Native App Cache Cleaning | N/A (Delegates to Bridge) | 🛠️ Implemented via `context.cacheDir` |

---

## 8. Build & Deployment Instructions

### Web Application:
1. `npm install`
2. `npm run build`
3. Deploy to Cloud Run / any Node.js container with `PORT=3000`.

### Android Companion APK:
1. Open the project downloaded from the **"All Access & Project ZIP"** tab in Android Studio.
2. In `app/build.gradle.kts`, set your target SDK (35 recommended).
3. Set your production web URL in `MainActivity.kt`.
4. Click **Build → Generate Signed APK** or **Run (▶)** on a connected Android phone.
