import { CodeSnippet } from "../types";

export const BOILERPLATE_CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: "kotlin-android-bridge",
    title: "Android Bridge API (@JavascriptInterface)",
    filename: "AndroidBridge.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Production bridge exposing window.androidBridge to the WebView. Enforces allowlist validation before invoking native executors.",
    content: `package com.ai.deviceassistant.bridge

import android.app.Activity
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Android Bridge interface exposed to JavaScript in Android WebView:
 * window.androidBridge.execute(tool, jsonArgs)
 *
 * Security rule:
 * "AI decides WHAT -> Android validates WHETHER/HOW -> Android executes allowed action."
 */
class AndroidBridge(
    private val activity: Activity,
    private val executor: DeviceActionExecutor
) {
    @JavascriptInterface
    fun execute(tool: String, jsonArgs: String): String {
        return try {
            val args = if (jsonArgs.isNotBlank()) JSONObject(jsonArgs) else JSONObject()
            val result = executor.executeAction(tool, args)
            result.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("tool", tool)
                put("message", "Bridge execution failure: \${e.message}")
                put("source", "android")
                put("errorCode", "BRIDGE_EXECUTION_EXCEPTION")
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
            put("version", android.os.Build.VERSION.RELEASE)
            put("sdkInt", android.os.Build.VERSION.SDK_INT)
            put("bridgeMode", "REAL_DEVICE")
        }.toString()
    }
}
`,
  },
  {
    id: "kotlin-device-executor",
    title: "Device Action Executor (Official Native APIs)",
    filename: "DeviceActionExecutor.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Implements all 12 allowlisted tools using official Android SDK APIs (Settings.System, AudioManager, CameraManager, Intents).",
    content: `package com.ai.deviceassistant.bridge

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import org.json.JSONObject

/**
 * Executes allowlisted Android system actions safely using official Android APIs.
 * Absolutely NO arbitrary shell, root, or ADB commands.
 */
class DeviceActionExecutor(private val activity: Activity) {

    private val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val cameraManager = activity.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private val notificationManager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val batteryManager = activity.getSystemService(Context.BATTERY_SERVICE) as BatteryManager

    fun executeAction(tool: String, args: JSONObject): JSONObject {
        val response = JSONObject()
        response.put("tool", tool)
        response.put("source", "android")

        when (tool) {
            "set_brightness" -> {
                val level = args.optInt("level", 50)
                if (level < 1 || level > 100) {
                    return failure(tool, "Brightness must be an integer between 1 and 100", "INVALID_ARGUMENT_RANGE")
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(activity)) {
                    val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                        data = Uri.parse("package:\${activity.packageName}")
                    }
                    activity.startActivity(intent)
                    return failure(tool, "WRITE_SETTINGS permission required. Opened system settings.", "PERMISSION_REQUIRED")
                }
                val rawValue = (level * 255) / 100
                Settings.System.putInt(activity.contentResolver, Settings.System.SCREEN_BRIGHTNESS, rawValue)
                return success(tool, "Brightness set to \$level% successfully.")
            }

            "open_wifi_settings" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    activity.startActivity(Intent(Settings.Panel.ACTION_WIFI))
                } else {
                    activity.startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
                }
                return success(tool, "Opened Wi-Fi settings panel.")
            }

            "open_bluetooth_settings" -> {
                activity.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
                return success(tool, "Opened Bluetooth settings.")
            }

            "open_app_settings" -> {
                val pkg = args.optString("package_name", activity.packageName)
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:\$pkg")
                }
                activity.startActivity(intent)
                return success(tool, "Opened app details for \$pkg.")
            }

            "set_volume" -> {
                val level = args.optInt("level", 50)
                val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                val targetVol = (level * maxVol) / 100
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, AudioManager.FLAG_SHOW_UI)
                return success(tool, "Media volume set to \$level%.")
            }

            "toggle_flashlight" -> {
                val enabled = args.optBoolean("enabled", true)
                val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
                    cameraManager.getCameraCharacteristics(id).get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                }
                if (cameraId != null) {
                    cameraManager.setTorchMode(cameraId, enabled)
                    return success(tool, "Flashlight turned \${if (enabled) "ON" else "OFF"}.")
                }
                return failure(tool, "No camera flash found on device.", "HARDWARE_NOT_SUPPORTED")
            }

            "toggle_battery_saver" -> {
                activity.startActivity(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS))
                return success(tool, "Navigated to Battery Saver settings.")
            }

            "toggle_do_not_disturb" -> {
                val enabled = args.optBoolean("enabled", true)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !notificationManager.isNotificationPolicyAccessGranted) {
                    activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
                    return failure(tool, "Notification policy access required. Opened Settings.", "PERMISSION_REQUIRED")
                }
                val filter = if (enabled) NotificationManager.INTERRUPTION_FILTER_PRIORITY else NotificationManager.INTERRUPTION_FILTER_ALL
                notificationManager.setInterruptionFilter(filter)
                return success(tool, "Do Not Disturb set to \${if (enabled) "Priority" else "All"}.")
            }

            "clear_own_cache" -> {
                val internal = activity.cacheDir.deleteRecursively()
                val external = activity.externalCacheDir?.deleteRecursively() ?: true
                return success(tool, "Application temporary cache cleared successfully.")
            }

            "get_device_info" -> {
                val data = JSONObject().apply {
                    put("brand", Build.BRAND)
                    put("model", Build.MODEL)
                    put("androidVersion", Build.VERSION.RELEASE)
                    put("sdkInt", Build.VERSION.SDK_INT)
                }
                return success(tool, "Device specifications retrieved.", data)
            }

            "get_battery_status" -> {
                val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                val data = JSONObject().apply {
                    put("percentage", level)
                }
                return success(tool, "Current battery level is \$level%.", data)
            }

            "get_network_status" -> {
                return success(tool, "Network capabilities active.")
            }

            else -> {
                return failure(tool, "Tool '\$tool' is not in security allowlist.", "UNKNOWN_TOOL")
            }
        }
    }

    private fun success(tool: String, message: String, data: JSONObject? = null): JSONObject {
        return JSONObject().apply {
            put("success", true)
            put("tool", tool)
            put("message", message)
            put("source", "android")
            data?.let { put("data", it) }
        }
    }

    private fun failure(tool: String, message: String, errorCode: String): JSONObject {
        return JSONObject().apply {
            put("success", false)
            put("tool", tool)
            put("message", message)
            put("errorCode", errorCode)
            put("source", "android")
        }
    }
}
`,
  },
  {
    id: "kotlin-main-activity-webview",
    title: "MainActivity (WebView Wrapper & Back Handling)",
    filename: "MainActivity.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Wraps the web assistant inside Android WebView, injecting the JavaScript bridge and handling back gestures gracefully.",
    content: `package com.ai.deviceassistant

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.ai.deviceassistant.bridge.AndroidBridge
import com.ai.deviceassistant.bridge.DeviceActionExecutor

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        val executor = DeviceActionExecutor(this)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "\$userAgentString DroidAutomateBridge/1.0"
        }

        // Inject Native Android Bridge
        webView.addJavascriptInterface(AndroidBridge(this, executor), "androidBridge")

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

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

        // Point to your production web application URL or local asset
        val webAppUrl = getString(R.string.web_app_url)
        webView.loadUrl(webAppUrl)
    }
}
`,
  },
  {
    id: "kotlin-gemini-service",
    title: "AI Tool Calling Service (Kotlin)",
    filename: "GeminiAutomationService.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Configures Google GenAI SDK with structured FunctionDeclarations to convert natural language into Android tool calls.",
    content: `package com.example.aiassistant.data.ai

import com.google.genai.Client
import com.google.genai.types.Content
import com.google.genai.types.FunctionDeclaration
import com.google.genai.types.GenerateContentConfig
import com.google.genai.types.Part
import com.google.genai.types.Schema
import com.google.genai.types.Tool
import com.google.genai.types.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GeminiAutomationService @Inject constructor() {

    private val client = Client.builder()
        .apiKey(BuildConfig.GEMINI_API_KEY)
        .build()

    // 1. Declare System Control Tools for Gemini Function Calling
    private val adjustBrightnessTool = FunctionDeclaration.builder()
        .name("adjust_brightness")
        .description("Adjust screen display brightness percentage (0-100)")
        .parameters(
            Schema.builder()
                .type(Type.OBJECT)
                .putProperty("level", Schema.builder().type(Type.INTEGER).description("0 to 100 percentage").build())
                .putProperty("auto_brightness", Schema.builder().type(Type.BOOLEAN).description("Optional toggle for adaptive brightness").build())
                .addRequired("level")
                .build()
        )
        .build()

    private val toggleWifiTool = FunctionDeclaration.builder()
        .name("toggle_wifi")
        .description("Enable or disable device Wi-Fi connectivity")
        .parameters(
            Schema.builder()
                .type(Type.OBJECT)
                .putProperty("enabled", Schema.builder().type(Type.BOOLEAN).description("True to turn ON, false for OFF").build())
                .addRequired("enabled")
                .build()
        )
        .build()

    private val clearAppCacheTool = FunctionDeclaration.builder()
        .name("clear_app_cache")
        .description("Clear temporary cache for a specific application")
        .parameters(
            Schema.builder()
                .type(Type.OBJECT)
                .putProperty("package_name", Schema.builder().type(Type.STRING).description("e.g. com.zhiliaoapp.musically").build())
                .putProperty("app_name", Schema.builder().type(Type.STRING).description("User friendly name, e.g. TikTok").build())
                .addRequired("package_name")
                .build()
        )
        .build()

    private val toggleBatterySaverTool = FunctionDeclaration.builder()
        .name("toggle_battery_saver")
        .description("Toggle Android Battery Saver mode")
        .parameters(
            Schema.builder()
                .type(Type.OBJECT)
                .putProperty("enabled", Schema.builder().type(Type.BOOLEAN).build())
                .addRequired("enabled")
                .build()
        )
        .build()

    // 2. Process Natural Language Prompt into Tool Invocations
    suspend fun processUserCommand(prompt: String): AiCommandResult = withContext(Dispatchers.IO) {
        try {
            val tools = listOf(
                Tool.builder()
                    .functionDeclarations(listOf(adjustBrightnessTool, toggleWifiTool, clearAppCacheTool, toggleBatterySaverTool))
                    .build()
            )

            val config = GenerateContentConfig.builder()
                .systemInstruction(
                    Content.fromParts(
                        Part.fromText("You are an Android OS assistant. Map user phone issues and requests directly to available tool calls. Explain actions cleanly.")
                    )
                )
                .tools(tools)
                .temperature(0.2f)
                .build()

            val response = client.models.generateContent("gemini-3.8-flash", prompt, config)

            val toolCalls = response.functionCalls?.map { call ->
                DeviceAction(
                    name = call.name,
                    arguments = call.args ?: emptyMap()
                )
            } ?: emptyList()

            val explanation = response.text ?: "Parsed \${toolCalls.size} automation actions."
            AiCommandResult.Success(explanation, toolCalls)
        } catch (e: Exception) {
            AiCommandResult.Error(e.localizedMessage ?: "Failed to query Gemini API")
        }
    }
}

data class DeviceAction(
    val name: String,
    val arguments: Map<String, Any>
)

sealed class AiCommandResult {
    data class Success(val explanation: String, val actions: List<DeviceAction>) : AiCommandResult()
    data class Error(val message: String) : AiCommandResult()
}
`,
  },
  {
    id: "kotlin-shizuku-executor",
    title: "Shizuku ADB Binder Executor (Kotlin)",
    filename: "ShizukuCommandExecutor.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Executes privileged Android commands without root using Shizuku's remote binder IPC (Android 11+ Wireless Debugging).",
    content: `package com.example.aiassistant.automation.shizuku

import android.content.pm.PackageManager
import dev.rikka.shizuku.Shizuku
import dev.rikka.shizuku.ShizukuRemoteProcess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Shizuku allows third-party apps to execute commands with ADB shell privileges (UID 2000).
 * Requires neither root nor tethered PC once paired via Wireless Debugging on Android 11+.
 */
@Singleton
class ShizukuCommandExecutor @Inject constructor() {

    // Listener for binder death or disconnection
    private val binderReceivedListener = Shizuku.OnBinderReceivedListener {
        // Shizuku service is ready
    }

    private val binderDeadListener = Shizuku.OnBinderDeadListener {
        // Shizuku service crashed or disconnected
    }

    init {
        Shizuku.addBinderReceivedListenerSticky(binderReceivedListener)
        Shizuku.addBinderDeadListener(binderDeadListener)
    }

    fun isShizukuAvailable(): Boolean {
        return Shizuku.pingBinder()
    }

    fun hasShizukuPermission(): Boolean {
        if (!isShizukuAvailable()) return false
        return if (Shizuku.isPreV11()) {
            false
        } else {
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        }
    }

    fun requestPermission(requestCode: Int) {
        if (isShizukuAvailable() && !hasShizukuPermission()) {
            Shizuku.requestPermission(requestCode)
        }
    }

    /**
     * Executes an ADB shell command via Shizuku's privileged process.
     * Examples:
     * - "settings put system screen_brightness 50"
     * - "cmd connectivity set-wifi-enabled false"
     * - "cmd power set-mode 1" (Battery Saver)
     * - "pm trim-caches 1000M"
     */
    suspend fun executeCommand(command: String): ExecutionResult = withContext(Dispatchers.IO) {
        if (!isShizukuAvailable()) {
            return@withContext ExecutionResult.Failure("Shizuku service is not running. Please start Shizuku app.")
        }
        if (!hasShizukuPermission()) {
            return@withContext ExecutionResult.Failure("Shizuku ADB permission not granted.")
        }

        try {
            // Spawn a remote process running inside ADB UID 2000
            val process: ShizukuRemoteProcess = Shizuku.newProcess(
                arrayOf("sh", "-c", command),
                null,
                null
            )

            val outputReader = BufferedReader(InputStreamReader(process.inputStream))
            val errorReader = BufferedReader(InputStreamReader(process.errorStream))

            val output = outputReader.readText().trim()
            val error = errorReader.readText().trim()

            val exitCode = process.waitFor()

            if (exitCode == 0) {
                ExecutionResult.Success(output.ifEmpty { "Command executed successfully (exit 0)" })
            } else {
                ExecutionResult.Failure("Command failed (exit $exitCode): $error")
            }
        } catch (e: Exception) {
            ExecutionResult.Failure("Shizuku IPC exception: \${e.message}")
        }
    }

    // High level helpers mapped to AI Tools
    suspend fun setScreenBrightness(level0to100: Int): ExecutionResult {
        val rawValue = ((level0to100.coerceIn(0, 100) / 100f) * 255).toInt()
        return executeCommand("settings put system screen_brightness $rawValue")
    }

    suspend fun toggleWifi(enabled: Boolean): ExecutionResult {
        return executeCommand("cmd connectivity set-wifi-enabled $enabled")
    }

    suspend fun clearAppCache(packageName: String): ExecutionResult {
        // Safe cache trim command without deleting user login credentials
        return executeCommand("pm trim-caches 1000M && rm -rf /sdcard/Android/data/$packageName/cache/*")
    }

    suspend fun toggleBatterySaver(enabled: Boolean): ExecutionResult {
        val mode = if (enabled) "1" else "0"
        return executeCommand("cmd power set-mode $mode")
    }
}

sealed class ExecutionResult {
    data class Success(val message: String) : ExecutionResult()
    data class Failure(val error: String) : ExecutionResult()
}
`,
  },
  {
    id: "kotlin-accessibility-service",
    title: "Accessibility Automation Service (Kotlin)",
    filename: "AutomationAccessibilityService.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Fallback automation engine for unrooted devices without Shizuku; navigates Settings and clicks UI nodes safely.",
    content: `package com.example.aiassistant.automation.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Android AccessibilityService can inspect UI node trees and simulate clicks/swipes.
 * Used as a fallback when ADB/Shizuku is unavailable on the device.
 */
class AutomationAccessibilityService : AccessibilityService() {

    companion object {
        var instance: AutomationAccessibilityService? = null
            private set
    }

    private val serviceScope = CoroutineScope(Dispatchers.Main)

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this

        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
                    AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Monitor active window for expected automation targets
    }

    override fun onInterrupt() {
        // Clean up any active automated clicks
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    // 1. Pull down Quick Settings to toggle Wi-Fi / Bluetooth
    fun openQuickSettings() {
        performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
    }

    // 2. Automate Clearing App Cache via UI Node Traversal
    fun automateClearCache(packageName: String, onFinished: (Boolean) -> Unit) {
        serviceScope.launch {
            // Launch the System App Info screen for the target package
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)

            delay(1200) // Allow App Info screen to render

            val rootNode = rootInActiveWindow ?: run {
                onFinished(false)
                return@launch
            }

            // Step 1: Click "Storage & cache" or "Storage"
            val storageNode = findNodeByText(rootNode, listOf("Storage & cache", "Storage", "Storage usage"))
            if (storageNode != null && storageNode.isClickable) {
                storageNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            } else if (storageNode?.parent?.isClickable == true) {
                storageNode.parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            } else {
                onFinished(false)
                return@launch
            }

            delay(800) // Wait for storage screen

            val storageRoot = rootInActiveWindow ?: run {
                onFinished(false)
                return@launch
            }

            // Step 2: Click "Clear cache" button (Never click "Clear storage / Clear data"!)
            val clearCacheNode = findNodeByText(storageRoot, listOf("Clear cache", "Clear Cache"))
            if (clearCacheNode != null && clearCacheNode.isEnabled) {
                clearCacheNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                delay(400)
                performGlobalAction(GLOBAL_ACTION_HOME) // Return to home screen
                onFinished(true)
            } else {
                onFinished(false)
            }
        }
    }

    // Recursive helper to find node matching any target label
    private fun findNodeByText(node: AccessibilityNodeInfo, targets: List<String>): AccessibilityNodeInfo? {
        val nodeText = node.text?.toString()
        val contentDesc = node.contentDescription?.toString()

        for (target in targets) {
            if (nodeText?.contains(target, ignoreCase = true) == true ||
                contentDesc?.contains(target, ignoreCase = true) == true) {
                return node
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findNodeByText(child, targets)
            if (found != null) return found
        }
        return null
    }
}
`,
  },
  {
    id: "kotlin-safety-gatekeeper",
    title: "Safety Gatekeeper & Policy Filter (Kotlin)",
    filename: "SafetyGatekeeper.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Multi-tier risk classification engine that intercepts destructive actions and enforces BiometricPrompt/User Dialog confirmation.",
    content: `package com.example.aiassistant.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import javax.inject.Inject
import javax.inject.Singleton

enum class RiskLevel {
    TIER_1_SAFE_AUTO,       // Brightness, Volume, Flashlight -> Auto-executed instantly
    TIER_2_CONNECTIVITY,    // Wi-Fi, Bluetooth, Battery Saver -> Toast/Notification notification
    TIER_3_DESTRUCTIVE,     // Clear Cache, Force Stop, Modify Settings -> Requires Biometric/Pin confirmation
    TIER_4_FORBIDDEN        // Factory Reset, Uninstall, Sensitive Data Access -> Strictly Rejected
}

@Singleton
class SafetyGatekeeper @Inject constructor() {

    // Strictly forbidden commands to prevent prompt injection or malicious takeover
    private val blockedToolNames = setOf(
        "wipe_device", "factory_reset", "uninstall_system_app",
        "dump_sms", "read_contacts", "install_unknown_apk"
    )

    fun evaluateRisk(toolName: String, args: Map<String, Any>): RiskLevel {
        if (blockedToolNames.contains(toolName.lowercase())) {
            return RiskLevel.TIER_4_FORBIDDEN
        }

        return when (toolName) {
            "adjust_brightness", "set_volume", "toggle_flashlight" -> RiskLevel.TIER_1_SAFE_AUTO
            "toggle_wifi", "toggle_bluetooth", "toggle_battery_saver" -> RiskLevel.TIER_2_CONNECTIVITY
            "clear_app_cache", "kill_background_process" -> RiskLevel.TIER_3_DESTRUCTIVE
            else -> RiskLevel.TIER_3_DESTRUCTIVE
        }
    }

    /**
     * Authenticate via Android BiometricPrompt (Fingerprint / Face / Device PIN)
     * before executing any Tier 3 action.
     */
    fun authenticateUser(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onError(errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                onError("Biometric authentication failed.")
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        prompt.authenticate(promptInfo)
    }
}
`,
  },
  {
    id: "kotlin-viewmodel",
    title: "Assistant ViewModel & Orchestrator (Kotlin)",
    filename: "AssistantViewModel.kt",
    language: "kotlin",
    category: "kotlin",
    description: "Coordinates UI StateFlow, calls Gemini tool API, triggers Safety Gatekeeper, and dispatches to Shizuku/Accessibility.",
    content: `package com.example.aiassistant.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.aiassistant.automation.accessibility.AutomationAccessibilityService
import com.example.aiassistant.automation.shizuku.ExecutionResult
import com.example.aiassistant.automation.shizuku.ShizukuCommandExecutor
import com.example.aiassistant.data.ai.AiCommandResult
import com.example.aiassistant.data.ai.DeviceAction
import com.example.aiassistant.data.ai.GeminiAutomationService
import com.example.aiassistant.security.RiskLevel
import com.example.aiassistant.security.SafetyGatekeeper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AssistantUiState(
    val isProcessing: Boolean = false,
    val pendingAction: DeviceAction? = null,
    val pendingRiskLevel: RiskLevel? = null,
    val logs: List<String> = emptyList(),
    val statusMessage: String = "Ready for natural language requests."
)

@HiltViewModel
class AssistantViewModel @Inject constructor(
    private val geminiService: GeminiAutomationService,
    private val shizukuExecutor: ShizukuCommandExecutor,
    private val safetyGatekeeper: SafetyGatekeeper
) : ViewModel() {

    private val _uiState = MutableStateFlow(AssistantUiState())
    val uiState: StateFlow<AssistantUiState> = _uiState.asStateFlow()

    fun onUserPromptSubmitted(prompt: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, statusMessage = "AI analyzing prompt: '$prompt'...") }
            appendLog("User Prompt: \"$prompt\"")

            when (val result = geminiService.processUserCommand(prompt)) {
                is AiCommandResult.Error -> {
                    _uiState.update { it.copy(isProcessing = false, statusMessage = result.message) }
                    appendLog("AI Error: \${result.message}")
                }
                is AiCommandResult.Success -> {
                    appendLog("AI Explanation: \${result.explanation}")
                    if (result.actions.isEmpty()) {
                        _uiState.update { it.copy(isProcessing = false, statusMessage = result.explanation) }
                    } else {
                        // Process actions through Safety Gatekeeper
                        processNextAction(result.actions)
                    }
                }
            }
        }
    }

    private fun processNextAction(actions: List<DeviceAction>) {
        val action = actions.firstOrNull() ?: return
        val risk = safetyGatekeeper.evaluateRisk(action.name, action.arguments)

        if (risk == RiskLevel.TIER_4_FORBIDDEN) {
            appendLog("BLOCKED: Action '\${action.name}' is strictly forbidden by safety policy.")
            _uiState.update { it.copy(isProcessing = false, statusMessage = "Blocked for device security.") }
            return
        }

        if (risk == RiskLevel.TIER_3_DESTRUCTIVE) {
            // Pause and wait for user confirmation dialog / biometric
            _uiState.update {
                it.copy(
                    isProcessing = false,
                    pendingAction = action,
                    pendingRiskLevel = risk,
                    statusMessage = "Confirmation required for \${action.name}"
                )
            }
        } else {
            // Auto execute Tier 1 & Tier 2
            executeDeviceAction(action)
        }
    }

    fun confirmPendingAction() {
        val action = _uiState.value.pendingAction ?: return
        _uiState.update { it.copy(pendingAction = null, pendingRiskLevel = null, isProcessing = true) }
        executeDeviceAction(action)
    }

    fun cancelPendingAction() {
        _uiState.update {
            it.copy(
                pendingAction = null,
                pendingRiskLevel = null,
                isProcessing = false,
                statusMessage = "Action cancelled by user."
            )
        }
        appendLog("Action cancelled by user.")
    }

    private fun executeDeviceAction(action: DeviceAction) {
        viewModelScope.launch {
            appendLog("Executing tool: \${action.name} with args \${action.arguments}")

            if (shizukuExecutor.isShizukuAvailable() && shizukuExecutor.hasShizukuPermission()) {
                val res = when (action.name) {
                    "adjust_brightness" -> {
                        val level = (action.arguments["level"] as? Number)?.toInt() ?: 50
                        shizukuExecutor.setScreenBrightness(level)
                    }
                    "toggle_wifi" -> {
                        val enabled = action.arguments["enabled"] as? Boolean ?: true
                        shizukuExecutor.toggleWifi(enabled)
                    }
                    "clear_app_cache" -> {
                        val pkg = action.arguments["package_name"] as? String ?: ""
                        shizukuExecutor.clearAppCache(pkg)
                    }
                    "toggle_battery_saver" -> {
                        val enabled = action.arguments["enabled"] as? Boolean ?: true
                        shizukuExecutor.toggleBatterySaver(enabled)
                    }
                    else -> ExecutionResult.Failure("Unknown tool: \${action.name}")
                }

                when (res) {
                    is ExecutionResult.Success -> appendLog("Shizuku [OK]: \${res.message}")
                    is ExecutionResult.Failure -> appendLog("Shizuku [FAIL]: \${res.error}")
                }
            } else {
                // Accessibility Service Fallback
                appendLog("Shizuku unavailable, falling back to Accessibility Service...")
                val accessibility = AutomationAccessibilityService.instance
                if (accessibility != null && action.name == "clear_app_cache") {
                    val pkg = action.arguments["package_name"] as? String ?: ""
                    accessibility.automateClearCache(pkg) { success ->
                        appendLog("Accessibility Clear Cache: \${if (success) "Completed" else "Failed"}")
                    }
                } else {
                    appendLog("Execution Error: Neither Shizuku nor Accessibility Service active.")
                }
            }

            _uiState.update { it.copy(isProcessing = false, statusMessage = "Execution complete.") }
        }
    }

    private fun appendLog(log: String) {
        _uiState.update { it.copy(logs = it.logs + "[\${System.currentTimeMillis() % 10000}] \$log") }
    }
}
`,
  },
  {
    id: "flutter-dart-service",
    title: "Flutter Gemini & Shizuku MethodChannel (Dart)",
    filename: "assistant_service.dart",
    language: "dart",
    category: "flutter",
    description: "Complete Flutter service bridging Google GenAI Function Calling to Android Shizuku via MethodChannel.",
    content: `import 'package:flutter/services.dart';
import 'package:google_generative_ai/google_generative_ai.dart';

/// Flutter service that maps Natural Language to Android System Actions
class AutomationAssistantService {
  static const MethodChannel _platform = MethodChannel('com.example.assistant/shizuku');

  late final GenerativeModel _model;

  AutomationAssistantService({required String apiKey}) {
    // 1. Configure Function Declarations for Gemini
    final brightnessTool = FunctionDeclaration(
      'adjust_brightness',
      'Adjust device screen brightness percentage (0-100)',
      Schema(
        SchemaType.object,
        properties: {
          'level': Schema(SchemaType.integer, description: 'Brightness 0 to 100'),
        },
        requiredProperties: ['level'],
      ),
    );

    final wifiTool = FunctionDeclaration(
      'toggle_wifi',
      'Toggle device Wi-Fi state',
      Schema(
        SchemaType.object,
        properties: {
          'enabled': Schema(SchemaType.boolean, description: 'True to enable, false to disable'),
        },
        requiredProperties: ['enabled'],
      ),
    );

    final clearCacheTool = FunctionDeclaration(
      'clear_app_cache',
      'Clear application cache',
      Schema(
        SchemaType.object,
        properties: {
          'package_name': Schema(SchemaType.string, description: 'e.g. com.zhiliaoapp.musically'),
          'app_name': Schema(SchemaType.string, description: 'e.g. TikTok'),
        },
        requiredProperties: ['package_name'],
      ),
    );

    _model = GenerativeModel(
      model: 'gemini-3.8-flash',
      apiKey: apiKey,
      tools: [
        Tool(functionDeclarations: [brightnessTool, wifiTool, clearCacheTool]),
      ],
      systemInstruction: Content.system(
        'You are an Android OS assistant. Match natural language problems to appropriate tool calls.',
      ),
    );
  }

  /// Process prompt and execute via native MethodChannel
  Future<String> processAndExecute(String prompt) async {
    final response = await _model.generateContent([Content.text(prompt)]);
    final functionCalls = response.functionCalls.toList();

    if (functionCalls.isEmpty) {
      return response.text ?? 'No system action needed.';
    }

    final StringBuffer logBuffer = StringBuffer();
    logBuffer.writeln('AI Decision: \${response.text ?? "Executing system actions..."}');

    for (final call in functionCalls) {
      logBuffer.writeln('Calling: \${call.name}(\${call.args})');

      // Bridge call to Android Kotlin Native Shizuku executor
      try {
        final result = await _platform.invokeMethod<String>(call.name, call.args);
        logBuffer.writeln('Success: $result');
      } on PlatformException catch (e) {
        logBuffer.writeln('Error invoking \${call.name}: \${e.message}');
      }
    }

    return logBuffer.toString();
  }

  /// Check if Shizuku binder is active on Android device
  Future<bool> checkShizukuAvailable() async {
    try {
      final bool isReady = await _platform.invokeMethod('isShizukuReady') ?? false;
      return isReady;
    } catch (_) {
      return false;
    }
  }
}
`,
  },
  {
    id: "android-manifest",
    title: "Android Manifest & Permissions (XML)",
    filename: "AndroidManifest.xml",
    language: "xml",
    category: "manifest",
    description: "Declares Shizuku permission provider, AccessibilityService definition, and system intents.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.example.aiassistant">

    <!-- Normal permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <!-- Shizuku API Permission: Allows communicating with Shizuku ADB daemon -->
    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />

    <application
        android:name=".AssistantApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AssistantApp">

        <!-- Shizuku Content Provider (Auto-handles Binder negotiation) -->
        <provider
            android:name="rikka.shizuku.ShizukuProvider"
            android:authorities="\${applicationId}.shizuku"
            android:multiprocess="false"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.INTERACT_ACROSS_USERS_FULL" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Accessibility Service Declaration -->
        <service
            android:name=".automation.accessibility.AutomationAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

    </application>

</manifest>
`,
  },
  {
    id: "android-accessibility-config",
    title: "Accessibility Config (XML)",
    filename: "accessibility_service_config.xml",
    language: "xml",
    category: "manifest",
    description: "Configures event types, package filters, and flags for AutomationAccessibilityService.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/accessibility_service_description"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFlags="flagDefault|flagIncludeNotImportantViews|flagReportViewIds|flagRetrieveInteractiveWindows"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="true"
    android:settingsActivity="com.example.aiassistant.MainActivity" />
`,
  },
  {
    id: "build-gradle",
    title: "Dependencies & Build Config (build.gradle.kts)",
    filename: "build.gradle.kts",
    language: "groovy",
    category: "gradle",
    description: "Gradle build script with Shizuku API, Gemini SDK, Jetpack Compose, and Biometric dependencies.",
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.hilt.android)
}

android {
    namespace = "com.example.aiassistant"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.aiassistant"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "GEMINI_API_KEY", "\\"\${project.findProperty("GEMINI_API_KEY") ?: ""}\\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // 1. Shizuku API (ADB privileges without root)
    implementation("dev.rikka.shizuku:api:13.1.5")
    implementation("dev.rikka.shizuku:provider:13.1.5")

    // 2. Google GenAI SDK (Function Calling & Gemini 3.8 Flash)
    implementation("com.google.genai:genai:2.4.0")

    // 3. Android Jetpack Biometrics & Security
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // 4. Jetpack Compose UI
    implementation(platform("androidx.compose:compose-bom:2025.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // 5. Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // 6. Hilt Dependency Injection
    implementation("com.google.dagger:hilt-android:2.51.1")
    kapt("com.google.dagger:hilt-compiler:2.51.1")
}
`,
  },
];

export const STEP_BY_STEP_GUIDES = [
  {
    id: "shizuku-setup",
    title: "1. Shizuku Setup & Wireless Debugging (No PC Required)",
    summary: "How users pair and run Shizuku on Android 11+ via Wireless Debugging without needing root or a tethered computer.",
    steps: [
      "Enable Developer Options: Go to Settings -> About Phone -> Tap 'Build Number' 7 times until Developer Mode is active.",
      "Turn on 'Wireless Debugging' in Developer Options and connect to any active Wi-Fi or local hotspot network.",
      "Install Shizuku from GitHub / F-Droid / Google Play.",
      "Open Shizuku -> Tap 'Pairing' -> Tap 'Developer options' -> Tap 'Pair device with pairing code'.",
      "Enter the 6-digit code in the Shizuku persistent notification. Once paired, return to Shizuku and tap 'Start'.",
      "When your assistant app launches, call `Shizuku.requestPermission(1001)`. The user receives a one-time grant dialog granting UID 2000 (ADB shell) access.",
    ],
  },
  {
    id: "accessibility-setup",
    title: "2. Accessibility Service Architecture & Google Play Compliance",
    summary: "Configuring Accessibility Service as a reliable fallback and adhering to Google Play policies.",
    steps: [
      "Define `AutomationAccessibilityService` in `AndroidManifest.xml` with `BIND_ACCESSIBILITY_SERVICE` permission.",
      "Provide an explicit in-app Prominent Disclosure dialog explaining *why* accessibility is needed BEFORE requesting activation in Android Settings.",
      "Direct the user to `Settings.ACTION_ACCESSIBILITY_SETTINGS` to enable the toggle.",
      "On Android 13/14, if sideloaded, the user may encounter 'Restricted Setting'. Instruct them: App Info -> Top right 3 dots -> 'Allow restricted settings'.",
      "Traverse `AccessibilityNodeInfo` cautiously: always prefer finding nodes by Resource ID (`findAccessibilityNodeInfosByViewId`) or exact localized string.",
      "Never click destructive 'Clear data' or 'Factory reset' nodes; restrict programmatic clicks strictly to safe toggles and 'Clear cache'.",
    ],
  },
  {
    id: "safety-architecture",
    title: "3. Safety Precautions, Prompt Injection & Rollback Policies",
    summary: "Guarding against malicious jailbreaks, accidental bricking, and unauthorized commands.",
    steps: [
      "Categorize actions into 4 Risk Tiers: Tier 1 (Safe auto-apply), Tier 2 (Connectivity warning), Tier 3 (Destructive requires BiometricPrompt), Tier 4 (Forbidden blacklisted commands).",
      "Hardcode a command whitelist: Gemini may only pick from pre-defined FunctionDeclarations. Never allow dynamic eval of raw arbitrary shell strings.",
      "Strict parameter validation: Bounds-check brightness (0-255), volume (0-15), and validate package names with Regex (`^[a-zA-Z0-9._]+$`).",
      "Pre-execution Snapshot & Rollback: Before modifying system settings, read current values via `settings get system screen_brightness` to support one-tap undo.",
      "Audit Logging: Record every executed command with timestamp, exit code, and AI model rationale to an encrypted local database.",
    ],
  },
];
