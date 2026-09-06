package com.droidautomate.assistant

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "DroidAutomateApp"
        val WEB_APP_URL: String = BuildConfig.WEB_APP_URL
        private const val PERMISSION_REQUEST_CODE = 1001
        private const val REMOTE_LOAD_TIMEOUT_MS = 10000L
    }
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorContainer: FrameLayout
    private val mainHandler = Handler(Looper.getMainLooper())
    private var offlineFallbackShown = false
    private var remoteLoadTimedOut = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(0xFF020617.toInt()) }
        webView = WebView(this).apply { layoutParams = FrameLayout.LayoutParams(-1, -1); setBackgroundColor(0xFF020617.toInt()) }
        root.addView(webView)
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { layoutParams = FrameLayout.LayoutParams(-1, 8); max = 100; visibility = View.VISIBLE }
        root.addView(progressBar)
        errorContainer = FrameLayout(this).apply { layoutParams = FrameLayout.LayoutParams(-1, -1); setBackgroundColor(0xFF020617.toInt()); visibility = View.GONE
            addView(TextView(this@MainActivity).apply { setTextColor(0xFFF87171.toInt()); textSize = 14f; textAlignment = View.TEXT_ALIGNMENT_CENTER; text = "Connecting..."; setPadding(40, 40, 40, 40) }) }
        root.addView(errorContainer)
        setContentView(root)
        checkAndRequestPermissions(); configureWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { if (!offlineFallbackShown && webView.canGoBack()) webView.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() } } })
        loadWebControlCenter()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
            allowFileAccess = false; allowContentAccess = false; setSupportZoom(false)
            builtInZoomControls = false; displayZoomControls = false; mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "${userAgentString} DroidAutomateBridge/1.2.0 (Android Native APK)"
        }
        webView.addJavascriptInterface(AndroidBridge(this, webView), "androidBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) { if (!offlineFallbackShown) { progressBar.visibility = View.VISIBLE; errorContainer.visibility = View.GONE }; super.onPageStarted(view, url, favicon) }
            override fun onPageFinished(view: WebView?, url: String?) { if (!offlineFallbackShown) { progressBar.visibility = View.GONE; errorContainer.visibility = View.GONE; remoteLoadTimedOut = false }; super.onPageFinished(view, url) }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) { if (request?.isForMainFrame == true && !offlineFallbackShown) showOfflineFallback("Online Control Center unavailable. Offline-safe mode is active."); super.onReceivedError(view, request, error) }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true; if (uri.scheme != "https") return true
                val trusted = Uri.parse(WEB_APP_URL); return !(uri.host == trusted.host && (uri.port.takeIf { it != -1 } ?: 443) == (trusted.port.takeIf { it != -1 } ?: 443))
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) { if (!offlineFallbackShown) { progressBar.progress = newProgress; if (newProgress >= 100) progressBar.visibility = View.GONE }; super.onProgressChanged(view, newProgress) }
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean { Log.d(TAG, "[WebView] ${consoleMessage?.message()}"); return true }
        }
    }

    private fun loadWebControlCenter() {
        offlineFallbackShown = false; remoteLoadTimedOut = false; val uri = Uri.parse(WEB_APP_URL)
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) { showOfflineFallback("Invalid online Control Center URL."); return }
        progressBar.visibility = View.VISIBLE; webView.loadUrl(WEB_APP_URL); mainHandler.removeCallbacksAndMessages(null)
        mainHandler.postDelayed({ if (!offlineFallbackShown && !remoteLoadTimedOut) { remoteLoadTimedOut = true; showOfflineFallback("Online Control Center timed out. Offline-safe mode is active.") } }, REMOTE_LOAD_TIMEOUT_MS)
    }
    private fun showOfflineFallback(reason: String) { if (offlineFallbackShown) return; offlineFallbackShown = true; progressBar.visibility = View.GONE; errorContainer.visibility = View.GONE; mainHandler.removeCallbacksAndMessages(null); webView.stopLoading(); webView.loadUrl("file:///android_asset/offline/index.html"); Log.i(TAG, reason) }

    fun openOverlayPermission() { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))) }
    fun setFloatingAssistantEnabled(enabled: Boolean) { if (enabled) { if (!Settings.canDrawOverlays(this)) { openOverlayPermission(); return }; ContextCompat.startForegroundService(this, Intent(this, AssistantOverlayService::class.java)) } else stopService(Intent(this, AssistantOverlayService::class.java)) }

    private fun checkAndRequestPermissions() {
        val required = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO, Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS).filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (required.isNotEmpty()) ActivityCompat.requestPermissions(this, required.toTypedArray(), PERMISSION_REQUEST_CODE)
    }
    override fun onDestroy() { mainHandler.removeCallbacksAndMessages(null); webView.removeJavascriptInterface("androidBridge"); webView.destroy(); super.onDestroy() }
}
