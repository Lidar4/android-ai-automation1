package com.droidautomate.assistant

import android.content.Context
import org.json.JSONObject

object AutoReplyManager {
    private const val PREFS = "assistant_automation"
    private const val KEY_ENABLED = "sms_auto_reply_enabled"
    private const val KEY_TEMPLATE = "sms_auto_reply_template"
    private const val KEY_SENDER_FILTER = "sms_auto_reply_sender_filter"

    fun setSmsRule(context: Context, enabled: Boolean, template: String, senderFilter: String = "") {
        require(template.length <= 500) { "Reply template is too long." }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putString(KEY_TEMPLATE, template.trim())
            .putString(KEY_SENDER_FILTER, senderFilter.trim())
            .apply()
    }

    fun getSmsRule(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return JSONObject().apply {
            put("enabled", prefs.getBoolean(KEY_ENABLED, false))
            put("template", prefs.getString(KEY_TEMPLATE, "") ?: "")
            put("senderFilter", prefs.getString(KEY_SENDER_FILTER, "") ?: "")
        }
    }

    fun buildReply(context: Context, sender: String): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ENABLED, false)) return null
        val filter = prefs.getString(KEY_SENDER_FILTER, "")?.trim().orEmpty()
        if (filter.isNotEmpty() && !sender.replace(" ", "").contains(filter.replace(" ", ""), ignoreCase = true)) return null
        val template = prefs.getString(KEY_TEMPLATE, "")?.trim().orEmpty()
        if (template.isEmpty()) return null
        return template.take(500).replace("{sender}", sender)
    }
}
