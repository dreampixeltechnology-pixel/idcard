'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // List video devices
  useEffect(() => {
    async function getDevices() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (err: any) {
        console.warn('Could not list media devices:', err);
      }
    }

    getDevices();
  }, [selectedDeviceId]);

  // Start the video stream
  useEffect(() => {
    let active = true;

    async function startStream() {
      setLoading(true);
      setError(null);

      // Stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setLoading(false);
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err: any) {
        if (active) {
          setError(
            err?.message ||
              'Unable to access camera. Please check permissions and ensure no other application is using it.'
          );
          setLoading(false);
        }
      }
    }

    startStream();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedDeviceId]);

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    // Maintain standard HD aspect ratio for crispness before sending to cropper
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onCapture(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-6 shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 font-bold font-display">
            <Camera className="h-5 w-5" />
            <span>Capture with Camera</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]" // mirror preview
            />
          )}

          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-2 text-white">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-xs">Connecting to video feed...</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-4 shrink-0">
          {/* Camera selector if multiple cameras exist */}
          {devices.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Camera
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none font-semibold text-slate-700"
              >
                {devices.map((device, i) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !!error}
              onClick={handleCapture}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Capture Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
