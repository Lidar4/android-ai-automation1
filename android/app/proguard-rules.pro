# Keep JavascriptInterface annotations for WebView bridge
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepclassmembers class com.droidautomate.assistant.AndroidBridge {
    public *;
}
