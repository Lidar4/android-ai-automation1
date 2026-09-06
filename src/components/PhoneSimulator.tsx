import React from "react";
import { 
  Wifi, 
  WifiOff, 
  Bluetooth, 
  BluetoothOff, 
  Sun, 
  Volume2, 
  VolumeX, 
  BatteryCharging, 
  BatteryMedium, 
  Zap, 
  BellOff, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Sliders,
  HardDrive,
  Trash2,
  Flashlight,
  Smartphone
} from "lucide-react";
import { DeviceState } from "../types";

interface PhoneSimulatorProps {
  deviceState: DeviceState;
  setDeviceState: React.Dispatch<React.SetStateAction<DeviceState>>;
  lastActionMessage?: string;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  deviceState,
  setDeviceState,
  lastActionMessage,
}) => {
  // Screen opacity based on brightness (0-100% -> maps to visual filter)
  const brightnessFilter = `brightness(${Math.max(0.2, deviceState.brightness / 100)})`;

  const handleToggleWifi = () => {
    setDeviceState((prev) => ({ ...prev, wifi: !prev.wifi }));
  };

  const handleToggleBluetooth = () => {
    setDeviceState((prev) => ({ ...prev, bluetooth: !prev.bluetooth }));
  };

  const handleToggleBatterySaver = () => {
    setDeviceState((prev) => ({ ...prev, batterySaver: !prev.batterySaver }));
  };

  const handleToggleFlashlight = () => {
    setDeviceState((prev) => ({ ...prev, flashlight: !prev.flashlight }));
  };

  const handleToggleDnd = () => {
    setDeviceState((prev) => ({ ...prev, dnd: !prev.dnd }));
  };

  const handleClearCache = (packageName: string) => {
    setDeviceState((prev) => ({
      ...prev,
      appCaches: prev.appCaches.map((app) =>
        app.packageName === packageName ? { ...app, cacheSizeMb: 0 } : app
      ),
    }));
  };

  const handleResetSimulator = () => {
    setDeviceState({
      brightness: 75,
      wifi: true,
      bluetooth: true,
      volume: 65,
      batterySaver: false,
      batteryLevel: 68,
      flashlight: false,
      dnd: false,
      appCaches: [
        { name: "TikTok", packageName: "com.zhiliaoapp.musically", cacheSizeMb: 1420 },
        { name: "Instagram", packageName: "com.instagram.android", cacheSizeMb: 850 },
        { name: "YouTube", packageName: "com.google.android.youtube", cacheSizeMb: 610 },
      ],
      shizukuConnected: true,
      accessibilityEnabled: true,
    });
  };

  return (
    <div className="flex flex-col items-center">
      {/* Explicit Simulator Mode Notice */}
      <div className="w-full max-w-sm mb-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[11px] flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-semibold">Interactive Phone Simulator</span>
        </div>
        <span className="text-[9px] font-mono text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded-full">
          Simulation only — no real device change
        </span>
      </div>

      {/* Simulation Control Toolbar */}
      <div className="w-full max-w-sm mb-3 flex items-center justify-between text-xs text-slate-400 px-2">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono">Pixel 9 Pro (Android 15)</span>
        </div>
        <button
          id="btn-reset-simulator"
          onClick={handleResetSimulator}
          className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset simulated phone state"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset State</span>
        </button>
      </div>

      {/* Realistic Android Phone Mockup Frame */}
      <div className="relative w-[340px] h-[680px] bg-slate-900 rounded-[44px] p-3 shadow-2xl shadow-black/80 border-4 border-slate-700/80 ring-1 ring-slate-600/50 flex flex-col justify-between overflow-hidden">
        
        {/* Dynamic Screen Dimming Overlay Effect */}
        <div 
          className="absolute inset-3 rounded-[36px] pointer-events-none transition-all duration-300 z-30"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${1 - Math.max(0.15, deviceState.brightness / 100)})`,
          }}
        />

        {/* Screen Content */}
        <div className="relative w-full h-full bg-slate-950 rounded-[36px] flex flex-col overflow-hidden text-slate-100 border border-slate-800">
          
          {/* Status Bar */}
          <div className="h-9 px-6 pt-2 flex items-center justify-between text-[11px] font-medium text-slate-300 z-20 select-none">
            <span>09:41</span>
            
            {/* Center Camera Punch-hole */}
            <div className="w-4 h-4 rounded-full bg-black border border-slate-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 ring-1 ring-cyan-950" />
            </div>

            {/* Quick Status Icons */}
            <div className="flex items-center space-x-2">
              {deviceState.dnd && <BellOff className="w-3 h-3 text-amber-400" />}
              {deviceState.flashlight && <Flashlight className="w-3 h-3 text-yellow-300 animate-pulse" />}
              {deviceState.wifi ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              )}
              {deviceState.bluetooth ? (
                <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <BluetoothOff className="w-3.5 h-3.5 text-slate-500" />
              )}
              <div className="flex items-center space-x-1">
                <span className="text-[10px]">{deviceState.batteryLevel}%</span>
                {deviceState.batterySaver ? (
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                ) : (
                  <BatteryMedium className="w-3.5 h-3.5 text-slate-300" />
                )}
              </div>
            </div>
          </div>

          {/* Battery Saver Warning Banner (if enabled) */}
          {deviceState.batterySaver && (
            <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1 flex items-center justify-between text-[10px] text-amber-300 font-medium">
              <span className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Battery Saver is Active</span>
              </span>
              <span className="text-amber-400 font-mono">cmd power 1</span>
            </div>
          )}

          {/* Phone Screen Body */}
          <div className="flex-1 px-4 py-3 flex flex-col space-y-3.5 overflow-y-auto text-xs z-10 scrollbar-none">
            
            {/* Quick Settings Grid Tiles */}
            <div className="grid grid-cols-2 gap-2">
              {/* Wi-Fi Tile */}
              <button
                id="phone-tile-wifi"
                onClick={handleToggleWifi}
                className={`p-2.5 rounded-2xl flex items-center space-x-2.5 transition-all text-left ${
                  deviceState.wifi
                    ? "bg-emerald-600/30 border border-emerald-500/50 text-emerald-200"
                    : "bg-slate-900 border border-slate-800 text-slate-400"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${deviceState.wifi ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] text-slate-200 leading-tight">Internet</span>
                  <span className="text-[10px] text-slate-400 font-mono">{deviceState.wifi ? "Connected" : "Off"}</span>
                </div>
              </button>

              {/* Bluetooth Tile */}
              <button
                id="phone-tile-bluetooth"
                onClick={handleToggleBluetooth}
                className={`p-2.5 rounded-2xl flex items-center space-x-2.5 transition-all text-left ${
                  deviceState.bluetooth
                    ? "bg-cyan-600/30 border border-cyan-500/50 text-cyan-200"
                    : "bg-slate-900 border border-slate-800 text-slate-400"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${deviceState.bluetooth ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] text-slate-200 leading-tight">Bluetooth</span>
                  <span className="text-[10px] text-slate-400 font-mono">{deviceState.bluetooth ? "Active" : "Off"}</span>
                </div>
              </button>

              {/* Battery Saver Tile */}
              <button
                id="phone-tile-batterysaver"
                onClick={handleToggleBatterySaver}
                className={`p-2.5 rounded-2xl flex items-center space-x-2.5 transition-all text-left ${
                  deviceState.batterySaver
                    ? "bg-amber-600/30 border border-amber-500/50 text-amber-200"
                    : "bg-slate-900 border border-slate-800 text-slate-400"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${deviceState.batterySaver ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] text-slate-200 leading-tight">Power Saver</span>
                  <span className="text-[10px] text-slate-400 font-mono">{deviceState.batterySaver ? "Enabled" : "Off"}</span>
                </div>
              </button>

              {/* Flashlight Tile */}
              <button
                id="phone-tile-flashlight"
                onClick={handleToggleFlashlight}
                className={`p-2.5 rounded-2xl flex items-center space-x-2.5 transition-all text-left ${
                  deviceState.flashlight
                    ? "bg-yellow-500/30 border border-yellow-500/50 text-yellow-200"
                    : "bg-slate-900 border border-slate-800 text-slate-400"
                }`}
              >
                <div className={`p-1.5 rounded-xl ${deviceState.flashlight ? "bg-yellow-400 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Flashlight className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[11px] text-slate-200 leading-tight">Flashlight</span>
                  <span className="text-[10px] text-slate-400 font-mono">{deviceState.flashlight ? "Torch On" : "Off"}</span>
                </div>
              </button>
            </div>

            {/* Display Brightness Control Slider */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-300">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Display Brightness</span>
                </span>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">{deviceState.brightness}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={deviceState.brightness}
                onChange={(e) =>
                  setDeviceState((prev) => ({ ...prev, brightness: Number(e.target.value) }))
                }
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                <span>Raw: {Math.round((deviceState.brightness / 100) * 255)} / 255</span>
                <span>settings put system screen_brightness</span>
              </div>
            </div>

            {/* Media Audio Volume Slider */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-300">
                  {deviceState.volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Media Stream Volume</span>
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">{deviceState.volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={deviceState.volume}
                onChange={(e) =>
                  setDeviceState((prev) => ({ ...prev, volume: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* App Cache & Storage Status */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-300">
                  <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                  <span>Target App Storage Caches</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">pm trim-caches</span>
              </div>

              <div className="space-y-1.5 pt-1">
                {deviceState.appCaches.map((app) => (
                  <div
                    key={app.packageName}
                    className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200 text-[11px]">{app.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{app.packageName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[11px] font-mono font-medium ${
                          app.cacheSizeMb > 0 ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {app.cacheSizeMb > 0 ? `${app.cacheSizeMb} MB` : "Cleared"}
                      </span>
                      {app.cacheSizeMb > 0 && (
                        <button
                          onClick={() => handleClearCache(app.packageName)}
                          title="Clear cache manually"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daemon Subsystems Toggle (Shizuku & Accessibility) */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                <span>Subsystem Drivers</span>
                <span className="text-[10px] text-slate-500">Simulate toggles</span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                <span className="text-slate-400">Shizuku Binder (UID 2000)</span>
                <button
                  onClick={() =>
                    setDeviceState((prev) => ({
                      ...prev,
                      shizukuConnected: !prev.shizukuConnected,
                    }))
                  }
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
                    deviceState.shizukuConnected
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                  }`}
                >
                  {deviceState.shizukuConnected ? "Connected" : "Disconnected"}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Accessibility Service</span>
                <button
                  onClick={() =>
                    setDeviceState((prev) => ({
                      ...prev,
                      accessibilityEnabled: !prev.accessibilityEnabled,
                    }))
                  }
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
                    deviceState.accessibilityEnabled
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {deviceState.accessibilityEnabled ? "Active" : "Disabled"}
                </button>
              </div>
            </div>

            {/* Last Execution Indicator */}
            {lastActionMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] flex items-start space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="leading-snug">{lastActionMessage}</span>
              </div>
            )}

          </div>

          {/* Android Navigation Gesture Bar */}
          <div className="h-6 flex items-center justify-center z-20 pb-1">
            <div className="w-24 h-1 rounded-full bg-slate-600/70" />
          </div>

        </div>
      </div>
    </div>
  );
};
