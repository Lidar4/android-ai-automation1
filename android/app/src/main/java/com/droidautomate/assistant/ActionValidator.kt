package com.droidautomate.assistant

import org.json.JSONObject

data class ActionValidationResult(
    val valid: Boolean,
    val tool: String,
    val sanitizedArgs: JSONObject,
    val requiresConfirmation: Boolean,
    val riskLevel: String, // "LOW", "MEDIUM", "HIGH"
    val requiredPermission: String? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null
)

/**
 * Android Central Action Validator
 * Strict gatekeeper running on the native Android side.
 * AI output is NEVER trusted blindly.
 */
object ActionValidator {

    private val ALLOWED_TOOLS = setOf(
        "set_brightness",
        "open_wifi_settings",
        "open_bluetooth_settings",
        "open_app_settings",
        "set_volume",
        "toggle_flashlight",
        "toggle_battery_saver",
        "toggle_do_not_disturb",
        "clear_own_cache",
        "get_device_info",
        "get_battery_status",
        "get_network_status"
    )

    private val EXPLICITLY_PROHIBITED_PATTERNS = listOf(
        "shell", "exec", "root", "su", "adb", "bash", "chmod", "system_reboot", "reboot", "wipe", "rm_rf"
    )

    fun validate(tool: String, args: JSONObject): ActionValidationResult {
        val normalizedTool = tool.trim().lowercase()

        // 1. Allowlist containment check
        if (!ALLOWED_TOOLS.contains(normalizedTool)) {
            val isExplicitlyProhibited = EXPLICITLY_PROHIBITED_PATTERNS.any { normalizedTool.contains(it) } ||
                    normalizedTool.split("_", "-", " ", "/").any { it == "sh" || it == "su" }

            return ActionValidationResult(
                valid = false,
                tool = tool,
                sanitizedArgs = args,
                requiresConfirmation = false,
                riskLevel = "HIGH",
                errorCode = "ACTION_NOT_ALLOWED",
                errorMessage = if (isExplicitlyProhibited) {
                    "Execution of arbitrary shell, system or root commands is strictly prohibited."
                } else {
                    "Action '$tool' is not in the allowed device automation registry."
                }
            )
        }

        // 3. Argument schema & boundary checks
        val sanitized = JSONObject()

        when (normalizedTool) {
            "set_brightness" -> {
                if (!args.has("level")) {
                    return ActionValidationResult(
                        valid = false,
                        tool = normalizedTool,
                        sanitizedArgs = args,
                        requiresConfirmation = false,
                        riskLevel = "LOW",
                        errorCode = "INVALID_ARGUMENTS",
                        errorMessage = "Property 'level' (0-100) is required for brightness adjustment."
                    )
                }
                val level = args.optInt("level", -1)
                if (level < 0 || level > 100) {
                    return ActionValidationResult(
                        valid = false,
                        tool = normalizedTool,
                        sanitizedArgs = args,
                        requiresConfirmation = false,
                        riskLevel = "LOW",
                        errorCode = "INVALID_ARGUMENTS",
                        errorMessage = "Brightness level must be an integer between 0 and 100. Received: $level"
                    )
                }
                sanitized.put("level", level)
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = false,
                    riskLevel = "LOW",
                    requiredPermission = "android.permission.WRITE_SETTINGS"
                )
            }

            "set_volume" -> {
                if (!args.has("level")) {
                    return ActionValidationResult(
                        valid = false,
                        tool = normalizedTool,
                        sanitizedArgs = args,
                        requiresConfirmation = false,
                        riskLevel = "LOW",
                        errorCode = "INVALID_ARGUMENTS",
                        errorMessage = "Property 'level' (0-100) is required for volume adjustment."
                    )
                }
                val level = args.optInt("level", -1)
                if (level < 0 || level > 100) {
                    return ActionValidationResult(
                        valid = false,
                        tool = normalizedTool,
                        sanitizedArgs = args,
                        requiresConfirmation = false,
                        riskLevel = "LOW",
                        errorCode = "INVALID_ARGUMENTS",
                        errorMessage = "Volume level must be an integer between 0 and 100. Received: $level"
                    )
                }
                val streamType = args.optString("streamType", "MEDIA").uppercase()
                sanitized.put("level", level)
                sanitized.put("streamType", streamType)
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = false,
                    riskLevel = "LOW"
                )
            }

            "toggle_flashlight" -> {
                val enabled = args.optBoolean("enabled", true)
                sanitized.put("enabled", enabled)
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = false,
                    riskLevel = "LOW",
                    requiredPermission = "android.permission.CAMERA"
                )
            }

            "toggle_do_not_disturb" -> {
                val enabled = args.optBoolean("enabled", true)
                sanitized.put("enabled", enabled)
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = true,
                    riskLevel = "MEDIUM",
                    requiredPermission = "android.permission.ACCESS_NOTIFICATION_POLICY"
                )
            }

            "toggle_battery_saver" -> {
                val enabled = args.optBoolean("enabled", true)
                sanitized.put("enabled", enabled)
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = false,
                    riskLevel = "LOW"
                )
            }

            "clear_own_cache" -> {
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = true,
                    riskLevel = "MEDIUM"
                )
            }

            else -> {
                // Info tools & settings intent shortcuts
                return ActionValidationResult(
                    valid = true,
                    tool = normalizedTool,
                    sanitizedArgs = sanitized,
                    requiresConfirmation = false,
                    riskLevel = "LOW"
                )
            }
        }
    }
}
