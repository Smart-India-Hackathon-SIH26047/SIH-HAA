import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input via the browser's SpeechRecognition API.
 *
 * Chrome ends a recognition session on its own far more often than the
 * `continuous` flag suggests — after a couple of seconds of silence it fires
 * `no-speech` and stops, and it also stops after each utterance on some
 * builds. The first version of this hook treated every `onend` as "the user
 * finished" and only handed over the transcript at that point, so a pause
 * before speaking ended the session with nothing captured.
 *
 * This version:
 *   - hands over each final segment the moment it is recognised, rather than
 *     waiting for the session to end, so words appear as they are spoken;
 *   - restarts automatically while the user still wants the mic on, so a
 *     pause for thought does not silently switch it off;
 *   - only gives up on errors that a restart cannot fix (denied permission,
 *     no network), and says which happened.
 *
 * WHY IN-BROWSER, AND NOT THE BACKEND'S WHISPER: `/checkin` with channel
 * "voice" wants a server-side file path, which a browser cannot produce. The
 * backend now also has `POST /checkin/audio`, which takes a real upload and
 * runs the wav2vec2 voice-stress model; switching to it would make
 * `components.voice_stress` a genuine value instead of 0, at the cost of the
 * live transcript this gives.
 */

// Chrome refuses `start()` with InvalidStateError if the previous session has
// not finished tearing down, so a restart needs a beat of breathing room.
const RESTART_DELAY_MS = 300;

// Silence alone must never exhaust the restart budget — someone gathering
// their thoughts is the normal case here, not a fault. Only a burst of
// restarts in a very short window means something is actually broken.
const FAILURE_WINDOW_MS = 4000;
const MAX_RESTARTS_IN_WINDOW = 8;

// Chrome's speech recognition is a CLOUD service. When the browser cannot
// reach Google's speech servers the session opens normally and then simply
// never returns anything — no results, no error, no end event. Waiting on it
// forever looks identical to "the microphone is broken", so give up on it.
const DEAD_AIR_MS = 7000;

export function useVoiceInput({ lang = "en-IN", onFinalTranscript, onDeadAir } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  // A plain-language trace of what the recogniser last did. Speech recognition
  // fails silently in several ways that look identical from the outside, so
  // this is surfaced in the UI rather than hidden in the console.
  const [lastEvent, setLastEvent] = useState(null);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const restartTimesRef = useRef([]);
  const restartTimerRef = useRef(null);
  const callbackRef = useRef(onFinalTranscript);
  callbackRef.current = onFinalTranscript;
  const deadAirRef = useRef(onDeadAir);
  deadAirRef.current = onDeadAir;
  const deadAirTimerRef = useRef(null);
  const heardAnythingRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const buildRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    // Only claim to be listening once the browser says the microphone is
    // actually open, so the UI can never show "on" over a dead mic.
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setLastEvent(`started (${lang})`);

      // If nothing at all comes back, the service is unreachable rather than
      // the person being quiet — silence would still produce a no-speech error.
      clearTimeout(deadAirTimerRef.current);
      deadAirTimerRef.current = setTimeout(() => {
        if (heardAnythingRef.current || !shouldListenRef.current) return;
        setLastEvent("no response from speech service");
        shouldListenRef.current = false;
        clearTimeout(restartTimerRef.current);
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setIsListening(false);
        deadAirRef.current?.();
      }, DEAD_AIR_MS);
    };

    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          // Hand it over straight away rather than hoarding it until onend.
          const trimmed = text.trim();
          if (trimmed) callbackRef.current?.(trimmed);
        } else {
          pending += text;
        }
      }
      // Speech is arriving, so this session is healthy.
      heardAnythingRef.current = true;
      clearTimeout(deadAirTimerRef.current);
      restartTimesRef.current = [];
      setLastEvent(pending ? `hearing: "${pending.slice(0, 30)}"` : "heard a phrase");
      setInterim(pending);
    };

    recognition.onerror = (event) => {
      setLastEvent(`error: ${event.error}`);
      switch (event.error) {
        case "no-speech":
        case "aborted":
          // Normal. onend decides whether to keep waiting.
          break;
        case "not-allowed":
        case "service-not-allowed":
          shouldListenRef.current = false;
          setError("Microphone access is blocked. Allow it in your browser, or type instead.");
          break;
        case "network":
          shouldListenRef.current = false;
          setError("Speech recognition needs an internet connection. You can type instead.");
          break;
        case "audio-capture":
          shouldListenRef.current = false;
          setError("No microphone was found. You can type instead.");
          break;
        default:
          setError("Voice input didn't work. You can type instead.");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim("");
      setLastEvent((prev) => (prev?.startsWith("error") ? prev : "session ended"));

      if (!shouldListenRef.current) {
        setIsListening(false);
        return;
      }

      // Chrome ends a session after a couple of seconds of silence. Keep the
      // microphone open through that, so a pause for thought does not end it.
      const now = Date.now();
      restartTimesRef.current = [
        ...restartTimesRef.current.filter((at) => now - at < FAILURE_WINDOW_MS),
        now,
      ];

      if (restartTimesRef.current.length > MAX_RESTARTS_IN_WINDOW) {
        // Ending this fast this often is a real fault, not silence.
        shouldListenRef.current = false;
        setIsListening(false);
        setError("The microphone kept dropping out. You can type instead.");
        return;
      }

      // The delay matters: restarting synchronously here throws
      // InvalidStateError, which previously killed listening on the first pause.
      restartTimerRef.current = setTimeout(() => {
        if (!shouldListenRef.current) return;
        setLastEvent("restarting…");
        try {
          const next = buildRecognition();
          recognitionRef.current = next;
          next.start();
        } catch {
          recognitionRef.current = null;
          shouldListenRef.current = false;
          setIsListening(false);
          setError("Couldn't restart the microphone. You can type instead.");
        }
      }, RESTART_DELAY_MS);
    };

    return recognition;
  }, [lang]);

  const start = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;

    setError(null);
    restartTimesRef.current = [];
    heardAnythingRef.current = false;
    clearTimeout(restartTimerRef.current);
    clearTimeout(deadAirTimerRef.current);
    shouldListenRef.current = true;
    setIsListening(true);

    try {
      const recognition = buildRecognition();
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      // Clearing the ref matters: `start` bails out early when it is set, so
      // leaving a failed recognition here latched the microphone off for the
      // rest of the session — every later tap did nothing at all.
      recognitionRef.current = null;
      shouldListenRef.current = false;
      setIsListening(false);
      setError("Couldn't start the microphone. You can type instead.");
      setLastEvent("start() threw");
    }
  }, [isSupported, buildRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
    clearTimeout(deadAirTimerRef.current);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
    } else {
      setIsListening(false);
      setInterim("");
    }
  }, []);

  const toggle = useCallback(() => {
    if (shouldListenRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      clearTimeout(restartTimerRef.current);
      clearTimeout(deadAirTimerRef.current);
      recognitionRef.current?.abort();
    },
    [],
  );

  return { isSupported, isListening, interim, error, lastEvent, start, stop, toggle };
}
