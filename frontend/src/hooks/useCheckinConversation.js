import { useCallback, useRef, useState } from "react";
import { submitCheckin, submitCheckinAudio } from "@/api/endpoints";

let messageSeq = 0;
const nextId = () => `m${(messageSeq += 1)}`;



/**
 * Owns the check-in conversation: local message list, in-flight state, and
 * the safety-flag handoff.
 *
 * The scoring result (`score`, `band`, `components`) is intentionally NOT
 * surfaced to the UI. It goes to the officer side; showing a person their own
 * distress score would turn a conversation into an assessment.
 */
export function useCheckinConversation({
  personId,
  voiceMessageLabel = "Voice message",
  openingMessage = "Hello. How have things been for you lately?",
}) {
  const [messages, setMessages] = useState(() => [
    { id: "opening", role: "assistant", text: openingMessage },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [safetyFlag, setSafetyFlag] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const send = useCallback(
    async (text, { channel = "chat", spokeAloud = false } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setError(null);
      setMessages((prev) => [
        ...prev,
        // `spokeAloud` is presentation only — it marks the bubble with a mic
        // icon. The request still goes out on `channel`, which is "chat".
        { id: nextId(), role: "user", text: trimmed, channel, spokeAloud },
      ]);
      setIsSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await submitCheckin({
          personId,
          text: trimmed,
          channel,
          signal: controller.signal,
        });

        if (result.type === "safety_flag") {
          setSafetyFlag(result);
          if (result.message) {
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: result.message },
            ]);
          }
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: result.message,
            degraded: result.aiAvailable === false,
            // Rides along with the reply so it appears in the flow rather
            // than interrupting it. Null on almost every turn.
            supportOffer: result.supportOffer || null,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err);
        // Mark the message so the person can retry it rather than retype it.
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, failed: true } : m)),
        );
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [isSending, personId],
  );

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => m.id !== lastUser.id));
    send(lastUser.text, { channel: lastUser.channel, spokeAloud: lastUser.spokeAloud });
  }, [messages, send]);

  /**
   * Send a recording instead of text. The transcript comes back from the
   * server, so the person's own words only appear once Whisper has run.
   */
  const sendAudio = useCallback(
    async (blob, filename) => {
      if (isSending) return;

      setError(null);
      const placeholderId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: placeholderId, role: "user", text: voiceMessageLabel, spokeAloud: true, pending: true },
      ]);
      setIsSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await submitCheckinAudio({
          personId,
          blob,
          filename,
          signal: controller.signal,
        });

        // Replace the placeholder with what was actually heard, so the person
        // can see whether they were understood.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, text: result.transcript || m.text, pending: false }
              : m,
          ),
        );

        if (result.type === "safety_flag") {
          setSafetyFlag(result);
          if (result.message) {
            setMessages((prev) => [
              ...prev,
              { id: nextId(), role: "assistant", text: result.message },
            ]);
          }
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: result.message,
            degraded: result.aiAvailable === false,
            supportOffer: result.supportOffer || null,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err);
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, failed: true, pending: false } : m)),
        );
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [isSending, personId, voiceMessageLabel],
  );

  const dismissSafetyFlag = useCallback(() => setSafetyFlag(null), []);

  const dismissSupportOffer = useCallback((messageId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, supportOffer: null } : m)),
    );
  }, []);

  return {
    messages,
    isSending,
    safetyFlag,
    error,
    send,
    sendAudio,
    retryLast,
    dismissSafetyFlag,
    dismissSupportOffer,
  };
}
