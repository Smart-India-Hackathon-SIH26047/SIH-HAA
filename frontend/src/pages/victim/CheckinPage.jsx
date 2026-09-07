import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useCheckinConversation } from "@/hooks/useCheckinConversation";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import Orb from "@/components/Orb";
import SupportSheet from "./components/SupportSheet";
import SupportOffer from "./components/SupportOffer";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * The check-in screen.
 *
 * The orb is the centrepiece and reflects what is actually happening —
 * listening while the microphone is live, thinking while the server works,
 * speaking when a reply lands. Score and band are never shown here.
 */
export default function CheckinPage() {
  const { personId } = useAuth();
  const { t, lang } = useLang();
  const conversation = useCheckinConversation({
    personId,
    voiceMessageLabel: t("voiceMessage"),
    openingMessage: t("opening"),
  });
  const [value, setValue] = useState("");
  const [spokeAloud, setSpokeAloud] = useState(false);
  const [justReplied, setJustReplied] = useState(false);
  // Set once live transcription proves unreachable, so we stop trying it.
  const [liveVoiceDead, setLiveVoiceDead] = useState(false);
  const logRef = useRef(null);

  const voice = useVoiceInput({
    // The recogniser has to be told the language. Left on en-IN, Hindi speech
    // produces nothing at all — it does not fall back or guess.
    lang: lang === "hi" ? "hi-IN" : "en-IN",
    onFinalTranscript: (transcript) => {
      setSpokeAloud(true);
      setValue((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
    },
    // Chrome opened the mic but the speech service never answered. Fall back
    // to recording rather than leaving someone talking to a dead microphone.
    onDeadAir: () => setLiveVoiceDead(true),
  });

  // Fallback wherever live speech recognition is missing — which is most
  // browsers, since SpeechRecognition is Chrome/Edge only. The recording goes
  // to /checkin/audio and the server transcribes it.
  const recorder = useAudioRecorder({
    onRecorded: (blob, filename) => conversation.sendAudio(blob, filename),
  });

  // Live transcription when it exists, recording otherwise.
  const mode =
    voice.isSupported && !liveVoiceDead
      ? "live"
      : recorder.isSupported
        ? "record"
        : "none";
  const micActive = mode === "live" ? voice.isListening : recorder.isRecording;
  const micError = mode === "live" ? voice.error : recorder.error;
  // Visible trace of what the microphone is doing. Voice input fails in
  // several ways that all look like "nothing happened" from the outside.
  const micTrace =
    mode === "live"
      ? voice.lastEvent
      : recorder.isRecording
        ? `recording ${recorder.seconds}s`
        : recorder.lastEvent;

  const { messages, isSending, error } = conversation;
  const lastMessage = messages[messages.length - 1];

  // Let the orb "speak" briefly when a reply arrives, then settle.
  useEffect(() => {
    if (isSending || lastMessage?.role !== "assistant") return undefined;
    setJustReplied(true);
    const timer = setTimeout(() => setJustReplied(false), 3200);
    return () => clearTimeout(timer);
  }, [isSending, lastMessage]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const orbState = error
    ? "error"
    : isSending
      ? "processing"
      : micActive
        ? "listening"
        : justReplied
          ? "speaking"
          : "idle";

  const caption = error
    ? t("orbError")
    : isSending
      ? t("orbThinking")
      : micActive
        ? mode === "record"
          ? `${t("orbRecording")} ${recorder.seconds}s — ${t("orbRecordingHint")}`
          : t("orbListening")
        : t("orbIdle");

  const submit = (event) => {
    event?.preventDefault();
    const text = value.trim();
    if (!text || isSending) return;
    if (voice.isListening) voice.stop();
    conversation.send(text, { channel: "chat", spokeAloud });
    setValue("");
    setSpokeAloud(false);
  };

  // The switch has no state of its own: it shows, and controls, whether the
  // microphone is genuinely open. A separate "enabled" flag drifted out of
  // sync with reality and left the UI reading "Voice on" over a dead mic.
  const toggleVoiceMode = () => {
    if (micActive) {
      if (mode === "live") voice.stop();
      else recorder.stop();
      return;
    }
    if (mode === "live") voice.start();
    else if (mode === "record") recorder.start();
  };

  // Carry straight on into recording — the person was mid-sentence.
  useEffect(() => {
    if (liveVoiceDead && recorder.isSupported && !recorder.isRecording) recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveVoiceDead]);

  if (!personId) return <MissingIdentity />;

  const displayValue = voice.interim ? `${value} ${voice.interim}`.trim() : value;

  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="pt-2 text-center">
        <h1 className="font-head text-[clamp(23px,3.4vw,30px)]">{t("checkinGreeting")}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {t("checkinSub")}
        </p>
      </div>

      <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-4">
        <Orb state={orbState} size={164} className="max-[430px]:!h-[140px] max-[430px]:!w-[140px]" />
        <p className="min-h-[18px] text-center text-[13.5px] font-medium text-faint" aria-live="polite">
          {caption}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div
          ref={logRef}
          className="mx-auto flex max-h-[34vh] w-full max-w-[520px] flex-col gap-2.5 overflow-y-auto p-0.5"
          aria-live="polite"
        >
          {messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              <div
                className={[
                  "max-w-[82%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed",
                  message.role === "user"
                    ? "self-end rounded-br-[5px] bg-accent text-white"
                    : "self-start rounded-bl-[5px] border border-line-soft bg-surface text-ink",
                  message.failed ? "opacity-60" : "",
                ].join(" ")}
              >
                {message.spokeAloud && message.role === "user" && (
                  <Mic className="mb-0.5 mr-1.5 inline-block h-3.5 w-3.5 opacity-80" aria-label="Spoken" />
                )}
                {message.text}
              </div>

              {message.degraded && (
                <span className="mt-1 self-start text-[11.5px] text-faint">
                  {t("aiUnavailable")}
                </span>
              )}

              {message.failed && (
                <button
                  type="button"
                  onClick={conversation.retryLast}
                  className="mt-1.5 self-end text-xs text-muted hover:text-ink"
                >
                  {t("notSent")}
                </button>
              )}

              {message.supportOffer && (
                <div className="mt-2">
                  <SupportOffer
                    offer={message.supportOffer}
                    onDismiss={() => conversation.dismissSupportOffer(message.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Always rendered. If neither voice method works it shows as disabled
            with the reason — hiding it entirely left people wondering whether
            the feature was missing or broken. */}
        <div className="mx-auto flex w-full max-w-[520px] flex-wrap items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={micActive}
            onClick={toggleVoiceMode}
            disabled={mode === "none" || isSending}
            title={mode === "none" ? "This browser can't use the microphone" : undefined}
            className="group inline-flex items-center gap-2 rounded-full py-1 disabled:opacity-50"
          >
            <span
              className={[
                "relative h-5 w-9 rounded-full transition-colors",
                micActive ? "bg-accent" : "bg-line",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform",
                  micActive ? "translate-x-[1.125rem]" : "translate-x-0.5",
                ].join(" ")}
              />
            </span>
            <span
              className={[
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                micActive ? "text-accent-strong" : "text-muted",
              ].join(" ")}
            >
              {micActive ? (
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {micActive ? t("voiceOn") : t("voiceOff")}
            </span>
          </button>

          {mode === "none" && (
            <span className="text-xs text-muted">
              {t("voiceUnsupported")}
            </span>
          )}
          {liveVoiceDead && (
            <span className="w-full text-xs text-muted">{t("voiceSwitchedToRecording")}</span>
          )}
          {mode !== "none" && micActive && (
            <span className="text-xs text-muted">
              {mode === "live" ? t("voiceTypesLive") : t("voiceSendsRecording")}
            </span>
          )}
          {micError && <span className="text-xs text-band-elevated">{micError}</span>}
          {error && !micError && (
            <span className="text-xs text-band-elevated">
              {error.message || String(error)}
            </span>
          )}
          {micTrace && !micError && (
            <span className="ml-auto font-mono text-[11px] text-faint" title="Microphone status">
              {mode} · {micTrace}
            </span>
          )}
        </div>

        <form
          onSubmit={submit}
          className="mx-auto flex w-full max-w-[520px] items-center gap-2.5 rounded-full border border-line bg-surface py-[7px] pl-5 pr-2 shadow-soft"
        >
          {mode !== "none" && (
            <button
              type="button"
              onClick={mode === "live" ? voice.toggle : recorder.toggle}
              disabled={isSending}
              aria-label={micActive ? "Stop the microphone" : "Speak to Saathi"}
              aria-pressed={micActive}
              className={[
                "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
                micActive ? "bg-accent text-white" : "bg-accent-softer text-accent-strong",
              ].join(" ")}
              style={micActive ? { animation: "mic-pulse 1.6s var(--ease-calm) infinite" } : undefined}
            >
              <Mic className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}

          <input
            type="text"
            value={displayValue}
            onChange={(event) => setValue(event.target.value)}
            disabled={isSending}
            placeholder={
              micActive
                ? mode === "record"
                  ? t("composerRecording")
                  : t("composerListening")
                : t("composerPlaceholder")
            }
            aria-label="Your message"
            className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />

          <button
            type="submit"
            disabled={!value.trim() || isSending}
            aria-label={t("send")}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
          >
            <Send className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </form>
      </div>

      <SupportSheet flag={conversation.safetyFlag} onDismiss={conversation.dismissSafetyFlag} />
    </div>
  );
}

function MissingIdentity() {
  return (
    <div className="card p-6 text-center">
      <p className="font-semibold">No case is linked to this account yet</p>
      <p className="mt-2 text-sm text-muted">
        Set <code className="rounded bg-raised px-1 py-0.5 text-xs">VITE_DEMO_PERSON_ID</code> in{" "}
        <code className="rounded bg-raised px-1 py-0.5 text-xs">frontend/.env</code>, or link this
        account to a person record. See docs/auth-setup.md.
      </p>
    </div>
  );
}
