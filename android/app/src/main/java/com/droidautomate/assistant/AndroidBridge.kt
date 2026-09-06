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

/**
 * AndroidBridge
 * Injected as `window.androidBridge` into the WebView.
 * Exposes ONLY validated, controlled methods.
 * Strictest isolation: No Runtime.exec(), no reflection, no shell commands.
 */
class AndroidBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    private val executor = DeviceActionExecutor(activity)
    private var speechRecognizer: SpeechRecognizer? = null

    /**
     * Primary controlled execution entry point for web control center.
     */
    @JavascriptInterface
    fun execute(tool: String, argumentsJson: String): String {
        return try {
            val args = if (argumentsJson.isNotBlank()) JSONObject(argumentsJson) else JSONObject()

            // 1. Central Native Action Validation
            val validation = ActionValidator.validate(tool, args)

            if (!validation.valid) {
                val errorJson = JSONObject().apply {
                    put("success", false)
                    put("tool", tool)
                    val err = JSONObject().apply {
                        put("code", validation.errorCode ?: "ACTION_NOT_ALLOWED")
                        put("message", validation.errorMessage ?: "Action validation failed.")
                    }
                    put("error", err)
                    put("errorCode", validation.errorCode ?: "ACTION_NOT_ALLOWED")
                    put("message", validation.errorMessage ?: "Action validation failed.")
                    put("source", "android_bridge")
                    put("timestamp", System.currentTimeMillis())
                }
                return errorJson.toString()
            }

            // 2. Dispatch to DeviceActionExecutor
            val result = executor.execute(validation.tool, validation.sanitizedArgs)
            result.toString()
        } catch (e: Exception) {
            val fatalError = JSONObject().apply {
                put("success", false)
                put("tool", tool)
                val err = JSONObject().apply {
                    put("code", "BRIDGE_INTERNAL_ERROR")
                    put("message", "Bridge execution caught exception: ${e.message}")
                }
                put("error", err)
                put("errorCode", "BRIDGE_INTERNAL_ERROR")
                put("message", "Bridge execution caught exception: ${e.message}")
                put("source", "android_bridge")
                put("timestamp", System.currentTimeMillis())
            }
            fatalError.toString()
        }
    }

    /**
     * Confirms real device connection from WebView.
     */
    @JavascriptInterface
    fun isDeviceConnected(): Boolean {
        return true
    }

    /**
     * Securely queries hardware and OS telemetry.
     */
    @JavascriptInterface
    fun getDeviceInfo(): String {
        return DeviceInfoProvider.getDeviceInfo(activity).toString()
    }

    /**
     * Voice-ready speech recognition bridge.
     */
    @JavascriptInterface
    fun startSpeechRecognition() {
        activity.runOnUiThread {
            try {
                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity)
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                }

                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) {
                        dispatchSpeechResult("", isFinal = true, error = "Speech recognition error code: $error")
                    }

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        dispatchSpeechResult(text, isFinal = true)
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        if (text.isNotEmpty()) {
                            dispatchSpeechResult(text, isFinal = false)
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                dispatchSpeechResult("", isFinal = true, error = e.message)
            }
        }
    }

    @JavascriptInterface
    fun stopSpeechRecognition() {
        activity.runOnUiThread {
            try {
                speechRecognizer?.stopListening()
            } catch (e: Exception) {
                // Ignore cleanup errors
            }
        }
    }

    private fun dispatchSpeechResult(text: String, isFinal: Boolean, error: String? = null) {
        val safeText = JSONObject.quote(text)
        val js = if (error != null) {
            "window.__onAndroidSpeechError && window.__onAndroidSpeechError('${JSONObject.quote(error)}');"
        } else {
            "window.__onAndroidSpeechResult && window.__onAndroidSpeechResult($safeText, $isFinal);"
        }
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }
}
