package com.droidautomate.assistant

import org.json.JSONObject

data class ActionValidationResult(
    val valid: Boolean,
    val tool: String,
    val sanitizedArgs: JSONObject,
    val requiresConfirmation: Boolean,
    val riskLevel: String,
    val requiredPermission: String? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null
)

object ActionValidator {
    private val ALLOWED_TOOLS = setOf(
        "set_brightness", "open_wifi_settings", "open_bluetooth_settings", "open_app_settings",
        "set_volume", "toggle_flashlight", "toggle_battery_saver", "toggle_do_not_disturb",
        "clear_own_cache", "get_device_info", "get_battery_status", "get_network_status"
    )

    private val EXPLICITLY_PROHIBITED_PATTERNS = listOf(
        "shell", "exec", "root", "su", "adb", "bash", "chmod", "system_reboot", "reboot", "wipe", "rm_rf"
    )

    fun validate(tool: String, args: JSONObject): ActionValidationResult {
        val normalizedTool = tool.trim().lowercase()
        if (!ALLOWED_TOOLS.contains(normalizedTool)) {
            val prohibited = EXPLICITLY_PROHIBITED_PATTERNS.any { normalizedTool.contains(it) } ||
                normalizedTool.split("_", "-", " ", "/").any { it == "sh" || it == "su" }
            return ActionValidationResult(false, tool, args, false, "HIGH", errorCode = "ACTION_NOT_ALLOWED",
                errorMessage = if (prohibited) "Execution of arbitrary shell, system or root commands is strictly prohibited."
                else "Action '$tool' is not in the allowed device automation registry.")
        }

        val sanitized = JSONObject()
        when (normalizedTool) {
            "set_brightness" -> {
                if (!args.has("level") || args.opt("level") !is Number) return invalid(normalizedTool, "Property 'level' (1-100) must be an integer.")
                val level = args.optInt("level", -1)
                if (level !in 1..100) return invalid(normalizedTool, "Brightness level must be an integer between 1 and 100. Received: $level")
                sanitized.put("level", level)
                return ActionValidationResult(true, normalizedTool, sanitized, false, "LOW", "android.permission.WRITE_SETTINGS")
            }
            "set_volume" -> {
                if (!args.has("level") || args.opt("level") !is Number) return invalid(normalizedTool, "Property 'level' (0-100) must be an integer.")
                val level = args.optInt("level", -1)
                if (level !in 0..100) return invalid(normalizedTool, "Volume level must be an integer between 0 and 100. Received: $level")
                val streamType = args.optString("stream_type", args.optString("streamType", "MEDIA")).uppercase()
                val allowedStreams = setOf("MEDIA", "RING", "ALARM", "NOTIFICATION", "SYSTEM", "VOICE_CALL")
                if (streamType !in allowedStreams) return invalid(normalizedTool, "Unsupported stream_type: $streamType")
                sanitized.put("level", level)
                sanitized.put("stream_type", streamType)
                return ActionValidationResult(true, normalizedTool, sanitized, false, "LOW")
            }
            "toggle_flashlight" -> {
                sanitized.put("enabled", args.optBoolean("enabled", true))
                return ActionValidationResult(true, normalizedTool, sanitized, false, "LOW", "android.permission.CAMERA")
            }
            "toggle_do_not_disturb" -> {
                sanitized.put("enabled", args.optBoolean("enabled", true))
                return ActionValidationResult(true, normalizedTool, sanitized, true, "MEDIUM", "android.permission.ACCESS_NOTIFICATION_POLICY")
            }
            "toggle_battery_saver" -> {
                sanitized.put("enabled", args.optBoolean("enabled", true))
                return ActionValidationResult(true, normalizedTool, sanitized, false, "LOW")
            }
            "clear_own_cache" -> return ActionValidationResult(true, normalizedTool, sanitized, true, "MEDIUM")
            else -> return ActionValidationResult(true, normalizedTool, sanitized, false, "LOW")
        }
    }

    private fun invalid(tool: String, message: String) = ActionValidationResult(
        false, tool, JSONObject(), false, "LOW", errorCode = "INVALID_ARGUMENTS", errorMessage = message
    )
}
