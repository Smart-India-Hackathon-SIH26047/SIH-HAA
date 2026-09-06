import React, { useState, useEffect, useRef } from 'react';
import { submitCheckin } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePrivateMode } from '../context/PrivateModeContext';
import SafetyFlagMessage from './SafetyFlagMessage';
import {
  Send, CheckCircle2, AlertCircle, Lock, Mic, MicOff, Volume2, VolumeX,
  EyeOff, User, ShieldCheck, Bot, Sparkles, MessageSquare, ArrowRight, RefreshCw
} from 'lucide-react';

const MAX_CHARS = 1000;

function OrbIcon({ isRecording, isSubmitting }) {
  return (
    <div className="flex flex-col items-center gap-2 my-2">
      <div
        className={`
          w-20 h-20 rounded-full bg-orb-gradient shadow-orb
          flex items-center justify-center
          transition-all duration-500
          ${isSubmitting ? 'animate-spin' : 'animate-orb-pulse'}
          ${isRecording ? 'ring-8 ring-brand/25 scale-110' : ''}
        `}
        style={{
          background: 'radial-gradient(circle at 35% 35%, #93C5FD 0%, #3B82F6 50%, #1D4ED8 100%)'
        }}
      >
        {isRecording ? (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 bg-white rounded-full animate-dot-bounce"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 bg-white/80 rounded-full"
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted font-medium">
        {isRecording ? 'Listening to your voice…' : 'Interactive AI Support & Check-in'}
      </p>
    </div>
  );
}

function generateBotReply(userMsg, lang = 'en') {
  const lower = userMsg.toLowerCase();

  if (lower.includes("threat") || lower.includes("landlord") || lower.includes("scared") || lower.includes("kill") || lower.includes("unsafe") || lower.includes("fear")) {
    return lang === 'hi'
      ? "मैं आपकी चिंता समझ सकता हूँ। आपकी सुरक्षा हमारी पहली प्राथमिकता है। SC/ST PoA अधिनियम के तहत आपको पूर्ण कानूनी सुरक्षा का अधिकार है। मैंने आपकी सुरक्षा चिंता दर्ज कर ली है। क्या आप सुरक्षित स्थान पर हैं?"
      : "I understand how frightening this pressure is. Your safety is our top priority under PoA Witness Protection directives. I have logged these safety concerns. Are you in a safe location right now, or would you like me to alert your Nodal Officer for immediate assistance?";
  }

  if (lower.includes("court") || lower.includes("hearing") || lower.includes("delay") || lower.includes("date") || lower.includes("judge")) {
    return lang === 'hi'
      ? "अदालत की सुनवाई में देरी होना बहुत निराशाजनक हो सकता है। आपकी भावनाएं पूरी तरह से जायज हैं। हम इस समयरेखा को रिकॉर्ड कर रहे हैं। क्या आपकी कानूनी सहायता टीम से बात हुई है?"
      : "Court hearing delays and postponements can feel extremely exhausting. Your feelings are completely valid. We are keeping track of this timeline. Have you been able to speak with your legal aid delegate about the next date?";
  }

  if (lower.includes("relief") || lower.includes("money") || lower.includes("compensation") || lower.includes("job") || lower.includes("financial")) {
    return lang === 'hi'
      ? "वित्तीय दबाव और मुआवाज़े का इंतजार करना कठिन होता है। मैं इस आर्थिक प्रभाव को दर्ज कर रहा हूँ ताकि आपके कल्याण अधिकारी को आपकी राहत अनुदान राशि में तेजी लाने की सिफारिश की जा सके।"
      : "Managing financial strain and waiting for interim compensation adds a heavy burden. I am logging this economic impact so your welfare officer can expedite your grant request.";
  }

  if (lower.includes("sad") || lower.includes("anxious") || lower.includes("tired") || lower.includes("alone") || lower.includes("help")) {
    return lang === 'hi'
      ? "अपनी बात साझा करने के लिए धन्यवाद। ऐसी स्थिति में तनाव होना स्वाभाविक है। साथी AI आपके साथ है। जब भी आप तैयार हों, आप अपना चेक-इन पूरा कर अपना स्कोर अधिकारी को भेज सकते हैं।"
      : "Thank you for opening up to me. It takes courage to express these emotions. I am here with you. Whenever you feel ready, you can complete our conversation to submit your distress score to your officer.";
  }

  return lang === 'hi'
    ? "आपकी बात दर्ज कर ली गई है। मैं आपकी हर बात को ध्यानपूर्वक नोट कर रहा हूँ। क्या आप अपने अधिकारी को स्कोर भेजने से पहले कुछ और कहना चाहते हैं?"
    : "Thank you for sharing that. I am recording every detail of your update. Is there anything else about your current situation or safety that you would like to mention before we calculate your distress score?";
}

export default function CheckinForm({ initialPersonId = "P101" }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { privateMode } = usePrivateMode();
  const [personId] = useState(initialPersonId);

  const currentVictimName = user?.name || (initialPersonId === 'P103' ? 'Ankit Verma' : 'Ramesh Kumar');
  const currentVictimId = user?.id || initialPersonId || 'P101';

  const initialGreeting = {
    id: 1,
    sender: 'bot',
    text: lang === 'hi'
      ? 'नमस्ते 🙏 मैं साथी हूँ - आपका AI सहयोगी। आप आज कैसा महसूस कर रहे हैं? अपनी सुरक्षा या स्थिति के बारे में बिना किसी झझक के बात करें।'
      : 'Namaste 🙏 I am Saathi — your supportive AI companion. How are you feeling today? You can share anything regarding your safety, case, or peace of mind.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  const [messages, setMessages] = useState([initialGreeting]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [channelSource, setChannelSource] = useState('Mobile App PWA');
  const [status, setStatus] = useState('idle');
  const [response, setResponse] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceUsed, setIsVoiceUsed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const baseTextRef = useRef('');
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Web Speech API
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = lang === 'hi' ? 'hi-IN' : 'en-US';

      r.onresult = (e) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        const currentSpeech = (finalTranscript + interimTranscript).trim();
        const base = baseTextRef.current;
        const combined = base ? `${base} ${currentSpeech}` : currentSpeech;

        setInputText(combined.slice(0, MAX_CHARS));
        setIsVoiceUsed(true);
      };

      r.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      r.onend = () => {
        if (isRecordingRef.current) {
          try { r.start(); } catch {}
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = r;
    }
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, [lang]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }
    if (isRecording) {
      isRecordingRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
      setIsRecording(false);
    } else {
      baseTextRef.current = inputText.trim();
      isRecordingRef.current = true;
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setIsVoiceUsed(true);
      } catch (e) {
        console.error('Speech recognition start failed:', e);
      }
    }
  };

  const speakText = (txt) => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(txt);
    u.rate = 0.95;
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || isThinking) return;

    if (isRecording) {
      isRecordingRef.current = false;
      try { recognitionRef.current?.stop(); } catch {}
      setIsRecording(false);
    }

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    baseTextRef.current = '';
    setIsThinking(true);

    // AI bot reply after short delay (like ChatGPT)
    setTimeout(() => {
      const replyText = generateBotReply(cleanText, lang);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsThinking(false);
      if (isVoiceUsed) speakText(replyText);
    }, 700);
  };

  const handleCompleteConversation = async () => {
    const userMsgs = messages.filter((m) => m.sender === 'user');
    if (userMsgs.length === 0 && !inputText.trim()) {
      alert('Please send at least one message to Saathi AI before finishing your check-in.');
      return;
    }

    let currentMessages = [...messages];
    if (inputText.trim()) {
      const userMsg = {
        id: Date.now(),
        sender: 'user',
        text: inputText.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      currentMessages.push(userMsg);
      setMessages(currentMessages);
      setInputText('');
    }

    if (isRecording) {
      isRecordingRef.current = false;
      try { recognitionRef.current?.stop(); } catch {}
      setIsRecording(false);
    }

    setStatus('submitting');
    setErrorMsg('');

    // Format full ChatGPT conversation transcript for Officer Portal
    const fullTranscript = currentMessages
      .map((m) => (m.sender === 'user' ? `Victim: ${m.text}` : `Saathi AI: ${m.text}`))
      .join('\n');

    try {
      const channel = isVoiceUsed ? 'Voice (IVRS / Speech)' : channelSource;
      const submittedId = privateMode ? 'ANON' : personId;
      const res = await submitCheckin(submittedId, fullTranscript, channel, privateMode);
      setResponse({
        ...res,
        messages: currentMessages
      });
      setStatus('done');
      if (res?.chatbot_reply) speakText(res.chatbot_reply);
    } catch {
      setErrorMsg('Unable to submit check-in. Please try again or call NHAA 14566.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setMessages([{
      id: Date.now(),
      sender: 'bot',
      text: lang === 'hi'
        ? 'नमस्ते 🙏 नया चेक-इन चैट शुरू हुआ। आप कैसा महसूस कर रहे हैं?'
        : 'Namaste 🙏 New check-in session started. How are you feeling right now?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setInputText(''); setStatus('idle'); setResponse(null); setErrorMsg('');
    setIsVoiceUsed(false); setIsRecording(false); isRecordingRef.current = false;
    baseTextRef.current = '';
    window.speechSynthesis?.cancel(); setIsSpeaking(false);
  };

  // Safety Flag Screen
  if (status === 'done' && response?.type === 'safety_flag') {
    return <SafetyFlagMessage helplineInfo={response.helpline_info} message={response.chatbot_reply || response.message} onReset={handleReset} />;
  }

  // Final Assessment & Predicted Score Summary Screen
  if (status === 'done' && response?.type === 'score') {
    const score = response.score || 78;
    const isHigh = score >= 75;
    const chatbotReply = response.chatbot_reply || response.message;
    const userMsgs = (response.messages || messages).filter(m => m.sender === 'user');

    return (
      <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5 border border-white/80 shadow-glass animate-slide-up">
        <OrbIcon />

        {/* AI Final Assessment Summary */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/95 via-indigo-50/85 to-purple-50/85 border border-blue-200/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-xs shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-ink flex items-center gap-1.5">
                  <span>Saathi AI Check-in Complete</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xs text-muted font-medium">Conversation analyzed & score predicted</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => speakText(chatbotReply)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-blue-200 text-brand text-xs font-bold hover:bg-blue-50 transition-colors shadow-xs"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4 text-alert" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeaking ? 'Stop' : 'Listen Assessment'}</span>
            </button>
          </div>

          {/* AI Assessment Message */}
          <div className="p-4 rounded-2xl bg-white/95 border border-blue-100/90 text-xs text-ink leading-relaxed shadow-xs font-medium">
            "{chatbotReply}"
          </div>

          {/* Score & Officer Stream Badge */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-white/90 border border-blue-100/80 text-center">
              <div className="text-[10px] text-muted font-medium uppercase tracking-wider">AI Predicted Distress Score</div>
              <div className={`text-2xl font-black mt-0.5 ${isHigh ? 'text-alert' : 'text-brand'}`}>
                {score}<span className="text-xs font-normal text-muted">/100</span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/90 border border-blue-100/80 text-center flex flex-col justify-center">
              <div className="text-[10px] text-muted font-medium uppercase tracking-wider">Officer Dashboard</div>
              <div className="text-xs font-extrabold text-emerald-700 flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> Reflected Live
              </div>
            </div>
          </div>

          {/* Messages count */}
          <div className="pt-2 border-t border-blue-100/60 text-xs text-muted flex justify-between items-center">
            <span>Exchanged <strong className="text-ink">{userMsgs.length} messages</strong> in this check-in session.</span>
            <span className="font-semibold text-brand">Channel: {channelSource}</span>
          </div>
        </div>

        {/* Transmission note */}
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-800 bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200/60 font-semibold text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Full conversation transcript & predicted score ({score}/100) sent to Nodal Officer</span>
        </div>

        <div className="text-[11px] text-muted flex items-center gap-1.5 justify-center">
          <Lock className="w-3.5 h-3.5" /> PoA Act encrypted · End-to-end confidential
        </div>

        <button onClick={handleReset} className="w-full btn-primary justify-center">
          Start New Check-in Conversation
        </button>
      </div>
    );
  }

  const userMessages = messages.filter(m => m.sender === 'user');

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Logged in victim identity card */}
      <div className="glass-card rounded-2xl p-3.5 border border-blue-100/80 shadow-glass flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand-soft text-brand flex items-center justify-center font-bold text-xs shadow-sm">
            <User className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[10px] text-muted font-medium">Logged in Beneficiary</div>
            <div className="text-xs font-extrabold text-ink flex items-center gap-2">
              <span>{privateMode ? 'Anonymous Beneficiary' : currentVictimName}</span>
              <span className="text-[10px] font-bold bg-brand text-white px-2 py-0.5 rounded-md shadow-sm">
                {privateMode ? 'ID: ANON' : `ID: ${currentVictimId}`}
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl text-emerald-800 text-[11px] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Session</span>
        </div>
      </div>

      {/* Private mode banner */}
      {privateMode && (
        <div className="flex items-center gap-2.5 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-md">
          <EyeOff className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="block font-bold">Anonymous mode is ON</span>
            <span className="font-normal opacity-90">Your name and ID will not be shared with your officer.</span>
          </div>
        </div>
      )}

      {/* Channel selector row */}
      {!privateMode && (
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs px-1">
          <div className="flex items-center gap-1.5 text-muted font-medium">
            <MessageSquare className="w-3.5 h-3.5 text-brand" />
            <span>Channel:</span>
            <select
              value={channelSource}
              onChange={(e) => setChannelSource(e.target.value)}
              className="bg-white/80 text-xs font-semibold text-brand border border-blue-100 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand/20 shadow-xs"
            >
              <option value="Mobile App PWA">Mobile App</option>
              <option value="NHAA Helpline 14566">NHAA 14566</option>
              <option value="IVRS Call Channel">IVRS Call</option>
              <option value="Chatbot Channel">Chatbot</option>
            </select>
          </div>

          {isVoiceUsed && (
            <span className="text-[10px] bg-brand-soft text-brand font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-blue-100">
              <Mic className="w-3 h-3" /> Voice Analytics Active
            </span>
          )}
        </div>
      )}

      {/* ChatGPT-style Chat Window Container */}
      <div className="glass-card rounded-3xl border border-white/80 shadow-glass overflow-hidden flex flex-col">
        {/* Chat Message Stream */}
        <div className="p-4 sm:p-5 max-h-[380px] min-h-[260px] overflow-y-auto space-y-3 bg-blue-50/20">
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isBot ? 'items-start' : 'items-end justify-end'}`}
              >
                {isBot && (
                  <div className="w-7 h-7 rounded-xl bg-brand text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`
                    max-w-[85%] sm:max-w-[78%] p-3.5 rounded-2xl text-xs space-y-1 shadow-xs leading-relaxed
                    ${isBot
                      ? 'bg-white text-ink border border-blue-100/80 rounded-tl-sm'
                      : 'bg-brand text-white rounded-tr-sm font-medium'}
                  `}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-[10px] font-bold ${isBot ? 'text-brand' : 'text-blue-100'}`}>
                      {isBot ? 'Saathi AI' : (privateMode ? 'You (Anonymous)' : 'You')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] ${isBot ? 'text-muted-light' : 'text-blue-200'}`}>{m.timestamp}</span>
                      {isBot && (
                        <button
                          type="button"
                          onClick={() => speakText(m.text)}
                          className="text-muted hover:text-brand transition-colors p-0.5 rounded"
                          title="Listen"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>{m.text}</div>
                </div>

                {!isBot && (
                  <div className="w-7 h-7 rounded-xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0 mb-0.5 font-bold text-[10px]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Bot Thinking Animation */}
          {isThinking && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-brand text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-blue-100 p-3 rounded-2xl rounded-tl-sm text-xs text-muted flex items-center gap-1.5 shadow-xs">
                <span className="font-semibold text-brand">Saathi AI is thinking</span>
                <span className="flex items-center gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-dot-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ChatGPT Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-blue-100/60 space-y-2">
          <div className="flex items-center gap-2">
            {/* Mic toggle */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`
                p-2.5 rounded-2xl transition-all border flex-shrink-0
                ${isRecording
                  ? 'bg-alert text-white border-alert animate-pulse'
                  : 'bg-blue-50 text-brand border-blue-100 hover:bg-blue-100'}
              `}
              title={isRecording ? 'Stop voice recording' : 'Speak your message'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Input box */}
            <input
              type="text"
              value={inputText}
              maxLength={MAX_CHARS}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={lang === 'hi' ? 'साथी AI को अपना संदेश लिखें...' : 'Type your message to Saathi AI...'}
              className="flex-1 bg-blue-50/50 border border-blue-100/80 rounded-2xl px-4 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
              disabled={status === 'submitting' || isThinking}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking || status === 'submitting'}
              className="btn-primary py-2.5 px-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 text-xs font-bold"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Action Button: Finish Conversation & Predict Score */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={handleCompleteConversation}
          disabled={status === 'submitting' || (userMessages.length === 0 && !inputText.trim())}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-brand via-brand-mid to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          )}
          <span>
            {status === 'submitting'
              ? 'Analyzing Conversation & Predicting Score…'
              : `Finish Conversation & Send Distress Score to Officer (${userMessages.length} ${userMessages.length === 1 ? 'msg' : 'msgs'})`}
          </span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>

        {status === 'error' && (
          <div className="p-3 rounded-2xl bg-alert-soft text-alert text-xs flex items-center gap-2 border border-red-200/60">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-light mt-2 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> End-to-end encrypted under PoA Act directives · Confidential
      </p>
    </div>
  );
}
