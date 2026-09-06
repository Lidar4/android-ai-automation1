package com.droidautomate.assistant

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.util.Locale

/** AndroidBridge exposes only validated, controlled native operations. */
class AndroidBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    private val executor = DeviceActionExecutor(activity)
    private var speechRecognizer: SpeechRecognizer? = null

    @JavascriptInterface
    fun execute(tool: String, argumentsJson: String): String {
        return try {
            val args = if (argumentsJson.isNotBlank()) JSONObject(argumentsJson) else JSONObject()
            val validation = ActionValidator.validate(tool, args)
            if (!validation.valid) {
                return JSONObject().apply {
                    put("success", false)
                    put("tool", tool)
                    put("error", JSONObject().apply {
                        put("code", validation.errorCode ?: "ACTION_NOT_ALLOWED")
                        put("message", validation.errorMessage ?: "Action validation failed.")
                    })
                    put("errorCode", validation.errorCode ?: "ACTION_NOT_ALLOWED")
                    put("message", validation.errorMessage ?: "Action validation failed.")
                    put("source", "android_bridge")
                    put("timestamp", System.currentTimeMillis())
                }.toString()
            }
            executor.execute(validation.tool, validation.sanitizedArgs).toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("tool", tool)
                put("error", JSONObject().apply {
                    put("code", "BRIDGE_INTERNAL_ERROR")
                    put("message", "Bridge execution caught exception: ${e.message}")
                })
                put("errorCode", "BRIDGE_INTERNAL_ERROR")
                put("message", "Bridge execution caught exception: ${e.message}")
                put("source", "android_bridge")
                put("timestamp", System.currentTimeMillis())
            }.toString()
        }
    }

    @JavascriptInterface
    fun isDeviceConnected(): Boolean = true

    @JavascriptInterface
    fun getDeviceInfo(): String = DeviceInfoProvider.getDeviceInfo(activity).toString()

    /** Configure a local, explicit SMS auto-reply rule. */
    @JavascriptInterface
    fun setSmsAutoReply(enabled: Boolean, template: String, senderFilter: String): String {
        return try {
            AutoReplyManager.setSmsRule(activity, enabled, template, senderFilter)
            JSONObject().apply {
                put("success", true)
                put("message", if (enabled) "SMS auto-reply enabled." else "SMS auto-reply disabled.")
                put("rule", AutoReplyManager.getSmsRule(activity))
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("errorCode", "INVALID_AUTOMATION_RULE")
                put("message", e.message ?: "Could not save automation rule.")
            }.toString()
        }
    }

    @JavascriptInterface
    fun getSmsAutoReply(): String = AutoReplyManager.getSmsRule(activity).toString()

    @JavascriptInterface
    fun startSpeechRecognition() {
        activity.runOnUiThread {
            try {
                if (speechRecognizer == null) speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity)
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD")
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                }
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) { dispatchSpeechResult("", true, "Speech recognition error code: $error") }
                    override fun onResults(results: Bundle?) {
                        dispatchSpeechResult(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: "", true)
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { if (it.isNotEmpty()) dispatchSpeechResult(it, false) }
                    }
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                speechRecognizer?.startListening(intent)
            } catch (e: Exception) { dispatchSpeechResult("", true, e.message) }
        }
    }

    @JavascriptInterface
    fun stopSpeechRecognition() {
        activity.runOnUiThread { try { speechRecognizer?.stopListening() } catch (_: Exception) {} }
    }

    private fun dispatchSpeechResult(text: String, isFinal: Boolean, error: String? = null) {
        val js = if (error != null) {
            "window.__onAndroidSpeechError && window.__onAndroidSpeechError(${JSONObject.quote(error)});"
        } else {
            "window.__onAndroidSpeechResult && window.__onAndroidSpeechResult(${JSONObject.quote(text)}, $isFinal);"
        }
        activity.runOnUiThread { webView.evaluateJavascript(js, null) }
    }
}
