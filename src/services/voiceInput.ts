/**
 * Voice Input Architecture & Providers Interface
 *
 * Security Principle:
 * Voice input feeds into the exact same AI command pipeline (handleSendMessage)
 * as text input. There is NEVER a separate or unvalidated execution path for voice.
 */

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface VoiceInputProvider {
  id: string;
  name: string;
  isSupported: () => boolean;
  startListening: (
    onResult: (result: VoiceRecognitionResult) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ) => void;
  stopListening: () => void;
}

/**
 * Standard Web Speech API Provider (browser & modern Android WebView)
 */
export class WebSpeechProvider implements VoiceInputProvider {
  public id = "web_speech";
  public name = "Web Speech API (W3C Standard)";
  private recognition: any = null;

  public isSupported(): boolean {
    return !!(
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public startListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError("Web Speech API is not supported in this environment.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: any) => {
        if (!event.results || event.results.length === 0) return;
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript;
        const confidence = lastResult[0].confidence || 0.9;
        const isFinal = lastResult.isFinal;

        onResult({
          transcript,
          isFinal,
          confidence,
        });
      };

      this.recognition.onerror = (event: any) => {
        onError(event.error || "Speech recognition encountered an error.");
      };

      this.recognition.onend = () => {
        onEnd();
      };

      this.recognition.start();
    } catch (err: any) {
      onError(err?.message || "Could not start voice recognition.");
    }
  }

  public stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.recognition = null;
    }
  }
}

/**
 * Android Native Bridge Voice Provider:
 * Prepared for APKs with native Android SpeechRecognizer (@JavascriptInterface startSpeechRecognition)
 */
export class AndroidNativeVoiceProvider implements VoiceInputProvider {
  public id = "android_native";
  public name = "Android Native SpeechRecognizer Bridge";

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as any).androidBridge?.startSpeechRecognition === "function"
    );
  }

  public startListening(
    onResult: (result: VoiceRecognitionResult) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): void {
    if (!this.isSupported()) {
      onError("Android Native SpeechRecognizer interface not found.");
      return;
    }

    // Register temporary callback on window for native Android APK to invoke
    (window as any).__onAndroidSpeechResult = (transcript: string, isFinal: boolean) => {
      onResult({ transcript, isFinal, confidence: 1.0 });
      if (isFinal) {
        delete (window as any).__onAndroidSpeechResult;
        onEnd();
      }
    };

    (window as any).androidBridge.startSpeechRecognition();
  }

  public stopListening(): void {
    if (typeof (window as any).androidBridge?.stopSpeechRecognition === "function") {
      (window as any).androidBridge.stopSpeechRecognition();
    }
  }
}

/**
 * Unified Voice Input Manager
 */
export class VoiceInputManager {
  private providers: VoiceInputProvider[] = [
    new WebSpeechProvider(),
    new AndroidNativeVoiceProvider(),
  ];

  public getActiveProvider(): VoiceInputProvider | null {
    return this.providers.find((p) => p.isSupported()) || null;
  }

  public isVoiceSupported(): boolean {
    return this.getActiveProvider() !== null;
  }
}

export const voiceInputManager = new VoiceInputManager();
