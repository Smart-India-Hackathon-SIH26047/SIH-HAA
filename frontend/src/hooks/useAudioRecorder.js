import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records microphone audio with MediaRecorder, for upload to /checkin/audio.
 *
 * This is the fallback wherever SpeechRecognition is missing — which is most
 * browsers: live speech recognition is a Chrome/Edge feature, absent in
 * Firefox and in Safari on iOS. MediaRecorder plus getUserMedia is supported
 * essentially everywhere, so voice input still works; the transcript comes
 * back from the server's Whisper rather than appearing as you speak.
 *
 * The upside over the browser path: the backend runs the wav2vec2 model over
 * the real audio, so the voice-stress score is genuine rather than 0.
 */

/** First container the browser will actually produce. */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4", // Safari
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || null;
}

export function useAudioRecorder({ onRecorded } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  // Plain-language trace, surfaced in the UI. Recording fails in ways that
  // all look like "nothing happened" otherwise.
  const [lastEvent, setLastEvent] = useState(null);
  // Live input level, 0..1. A microphone can open successfully and still
  // deliver silence — wrong device, muted at the OS, or held by another app.
  // Without this the failure is invisible until the server rejects the upload.
  const [level, setLevel] = useState(0);
  const [heardSound, setHeardSound] = useState(false);
  const [metering, setMetering] = useState(false);

  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const peakRef = useRef(0);
  // Whether the level meter is actually running. A broken meter must never be
  // allowed to veto a recording.
  const meteringOkRef = useRef(false);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const callbackRef = useRef(onRecorded);
  callbackRef.current = onRecorded;

  const isSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || recorderRef.current) return;
    setError(null);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it in your browser, or type instead."
          : "No microphone was found. You can type instead.",
      );
      return;
    }

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError("This browser can't record audio. You can type instead.");
      return;
    }

    chunksRef.current = [];
    streamRef.current = stream;
    recorderRef.current = recorder;

    // Meter the input so silence is visible while it is happening.
    peakRef.current = 0;
    meteringOkRef.current = false;
    setMetering(false);
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Chrome creates an AudioContext SUSPENDED unless it is constructed
      // inside a user gesture, and the await on getUserMedia above has already
      // spent ours. A suspended context feeds the analyser nothing: every
      // sample sits at the 128 midpoint and RMS reads exactly 0, so the meter
      // reports silence however loud the microphone actually is.
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          // Left suspended; handled by meteringOkRef below.
        }
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      meteringOkRef.current = ctx.state === "running";
      setMetering(meteringOkRef.current);

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / samples.length);
        peakRef.current = Math.max(peakRef.current, rms);
        setLevel(rms);
        // Comfortably above the noise floor of a working but quiet mic.
        if (rms > 0.02) setHeardSound(true);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Metering is a diagnostic, never a reason to block recording.
      meteringOkRef.current = false;
      setMetering(false);
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        chunksRef.current.push(event.data);
        setLastEvent(`captured ${Math.round(chunksRef.current.reduce((n, c) => n + c.size, 0) / 1024)}KB`);
      }
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      cleanup();
      setIsRecording(false);
      setSeconds(0);

      // Never drop a recording silently. A tap that caught nothing usable
      // must say so, or it looks identical to the app ignoring the person.
      if (!blob.size) {
        setLastEvent("stopped: no audio captured");
        setError("No audio was captured. Check the microphone is not muted.");
        return;
      }
      // Only trust a silence verdict when the meter was genuinely running.
      // Blocking an upload on a diagnostic that may itself have failed is how
      // a working microphone gets reported as broken.
      if (meteringOkRef.current && peakRef.current < 0.02) {
        setLastEvent(`stopped: silent (peak ${peakRef.current.toFixed(3)})`);
        setError(
          "No sound reached the microphone. Check it isn't muted, and that the " +
            "right input device is selected in your system settings and in the " +
            "browser's address-bar microphone menu.",
        );
        return;
      }
      if (blob.size < 1200) {
        setLastEvent(`stopped: only ${blob.size}B`);
        setError("That was too short to make out. Try holding the mic a little longer.");
        return;
      }

      setLastEvent(`sending ${Math.round(blob.size / 1024)}KB`);
      callbackRef.current?.(blob, type.includes("mp4") ? "checkin.mp4" : "checkin.webm");
    };

    // A timeslice makes ondataavailable fire during recording, so audio is
    // never lost if the final flush on stop misbehaves.
    recorder.start(1000);
    setIsRecording(true);
    setHeardSound(false);
    setLastEvent(meteringOkRef.current ? "recording" : "recording (meter off)");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((n) => n + 1), 1000);
  }, [isSupported, cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanup();
      setIsRecording(false);
      setSeconds(0);
    }
  }, [cleanup]);

  const toggle = useCallback(() => {
    if (recorderRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      cleanup();
    },
    [cleanup],
  );

  return {
    isSupported,
    isRecording,
    seconds,
    error,
    lastEvent,
    level,
    heardSound,
    metering,
    start,
    stop,
    toggle,
  };
}
