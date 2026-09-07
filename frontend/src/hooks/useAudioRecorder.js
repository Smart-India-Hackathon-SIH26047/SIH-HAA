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

  const recorderRef = useRef(null);
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
    setLastEvent("recording");
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

  return { isSupported, isRecording, seconds, error, lastEvent, start, stop, toggle };
}
