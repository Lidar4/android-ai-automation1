package com.droidautomate.assistant

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
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
import android.net.Uri

class MainActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "DroidAutomateApp"
        val WEB_APP_URL: String = BuildConfig.WEB_APP_URL
        private const val PERMISSION_REQUEST_CODE = 1001
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorContainer: FrameLayout
    private lateinit var errorTextView: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val rootLayout = FrameLayout(this).apply { setBackgroundColor(0xFF0F172A.toInt()) }
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            setBackgroundColor(0xFF0F172A.toInt())
        }
        rootLayout.addView(webView)
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 8)
            max = 100; progress = 0; visibility = View.VISIBLE
        }
        rootLayout.addView(progressBar)
        errorContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            setBackgroundColor(0xFF0F172A.toInt()); visibility = View.GONE
            errorTextView = TextView(this@MainActivity).apply {
                setTextColor(0xFFF87171.toInt()); textSize = 14f; textAlignment = View.TEXT_ALIGNMENT_CENTER
                text = "Connecting to Automation Control Center..."
            }
            addView(errorTextView)
        }
        rootLayout.addView(errorContainer)
        setContentView(rootLayout)
        checkAndRequestPermissions()
        configureWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
        loadWebControlCenter()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.userAgentString = "${settings.userAgentString} DroidAutomateBridge/1.0.0 (Android Native APK)"

        val bridge = AndroidBridge(this, webView)
        webView.addJavascriptInterface(bridge, "androidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE; errorContainer.visibility = View.GONE
                super.onPageStarted(view, url, favicon)
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE; super.onPageFinished(view, url)
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE; errorContainer.visibility = View.VISIBLE
                    errorTextView.text = "Failed to load Control Center (${error?.description ?: "Network Unavailable"}).\nTap to retry."
                    errorContainer.setOnClickListener { loadWebControlCenter() }
                }
                super.onReceivedError(view, request, error)
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                // Only the configured HTTPS origin may be loaded in this WebView.
                // This protects the native JavaScript bridge from untrusted pages.
                if (uri.scheme != "https") return true
                val trusted = Uri.parse(WEB_APP_URL)
                val sameOrigin = uri.scheme == trusted.scheme &&
                    uri.host == trusted.host &&
                    (uri.port.takeIf { it != -1 } ?: 443) == (trusted.port.takeIf { it != -1 } ?: 443)
                return !sameOrigin
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress >= 100) progressBar.visibility = View.GONE
                super.onProgressChanged(view, newProgress)
            }
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d(TAG, "[WebView Console] ${consoleMessage?.message()}")
                return true
            }
        }
    }

    private fun loadWebControlCenter() {
        val uri = Uri.parse(WEB_APP_URL)
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) {
            errorContainer.visibility = View.VISIBLE
            errorTextView.text = "Invalid or insecure WEB_APP_URL. Configure an HTTPS Control Center URL."
            return
        }
        webView.loadUrl(WEB_APP_URL)
    }

    private fun checkAndRequestPermissions() {
        val required = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) required.add(Manifest.permission.CAMERA)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) required.add(Manifest.permission.RECORD_AUDIO)
        if (required.isNotEmpty()) ActivityCompat.requestPermissions(this, required.toTypedArray(), PERMISSION_REQUEST_CODE)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("androidBridge")
        webView.destroy()
        super.onDestroy()
    }
}
