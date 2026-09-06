import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

export const TRANSLATIONS = {
  en: {
    portalTitle: "Saathi Portal",
    portalSubtitle: "Mental Health & Distress Prediction System",
    ministryBadge: "Ministry of Social Justice and Empowerment • NHAA 14566",
    checkinTitle: "How can we support you today?",
    checkinDesc: "Your wellbeing matters. Provide regular updates to help your designated welfare officer ensure your physical and legal protection.",
    checkinLabel: "How are you feeling today?",
    checkinPlaceholder: "Speak using the microphone above or write how you are feeling, safety concerns, or legal updates...",
    submitBtn: "Submit Check-in",
    submittingBtn: "Submitting...",
    recVoice: "Listening to your voice...",
    voiceInstruction: "Click the microphone button to dictate your check-in update hands-free.",
    readAloud: "Read Aloud",
    stopReading: "Stop Reading",
    officerDashboard: "Officer Dashboard",
    districtLevel: "District Level",
    stateLevel: "State Level",
    nationalLevel: "National Level (NHAA 14566)",
    priorityAlerts: "Priority Case Alerts",
    distressScore: "Distress Score",
    emotionAiTitle: "Emotion AI & Voice Stress Analytics",
    anxiety: "Anxiety Level",
    fear: "Fear / Threat Perception",
    hopelessness: "Hopelessness Score",
    voiceStress: "Voice Stress Pitch Elevation",
    xaiTitle: "Explainable AI (XAI) Justification",
    predictiveForecast: "30-Day Predictive Crisis Forecast",
    recommendedInterventions: "AI Recommended Interventions",
    witnessProtection: "Witness Protection Escort",
    expediteRelief: "Expedite Interim Compensation",
    relocationSupport: "Relocation & Safe Housing",
    psychiatricReferral: "Clinical Psychiatric Referral",
    legalAidEscort: "Legal Deposition Accompaniment",
    nhaaHelpline: "NHAA Toll-Free Helpline: 14566",
  },
  hi: {
    portalTitle: "साथी पोर्टल",
    portalSubtitle: "मानसिक स्वास्थ्य और संकट पूर्वानुमान प्रणाली",
    ministryBadge: "सामाजिक न्याय एवं अधिकारिता मंत्रालय • एनएचएए 14566",
    checkinTitle: "आज हम आपकी किस प्रकार सहायता कर सकते हैं?",
    checkinDesc: "आपकी भलाई हमारे लिए महत्वपूर्ण है। अपने कल्याण अधिकारी को आपकी सुरक्षा और कानूनी सहायता सुनिश्चित करने में मदद के लिए नियमित अपडेट दें।",
    checkinLabel: "आज आप कैसा महसूस कर रहे हैं?",
    checkinPlaceholder: "माइक बटन दबाकर बोलें या अपनी भावनाएं, सुरक्षा चिंताएं और कानूनी स्थिति लिखें...",
    submitBtn: "अद्यतन जमा करें",
    submittingBtn: "जमा हो रहा है...",
    recVoice: "आपकी आवाज़ सुनी जा रही है...",
    voiceInstruction: "बिना हाथ लगाए बोलने के लिए माइक बटन दबाएं।",
    readAloud: "सुनें (वॉइस)",
    stopReading: "रोकें",
    officerDashboard: "अधिकारी डैशबोर्ड",
    districtLevel: "जिला स्तर",
    stateLevel: "राज्य स्तर",
    nationalLevel: "राष्ट्रीय स्तर (NHAA 14566)",
    priorityAlerts: "प्राथमिकता मामला अलर्ट",
    distressScore: "संकट स्कोर",
    emotionAiTitle: "इमोशन एआई एवं वॉयस स्ट्रेस विश्लेषण",
    anxiety: "चिंता स्तर",
    fear: "भय / खतरा धारणा",
    hopelessness: "निराशा स्कोर",
    voiceStress: "वॉयस स्ट्रेस पिच वृद्धि",
    xaiTitle: "व्याख्यायोग्य एआई (XAI) कारण विश्लेषण",
    predictiveForecast: "30-दिवसीय पूर्वानुमानित संकट चेतावनी",
    recommendedInterventions: "एआई अनुशंसित हस्तक्षेप",
    witnessProtection: "गवाह सुरक्षा एस्कॉर्ट",
    expediteRelief: "अंतरिम राहत सहायता में तेजी",
    relocationSupport: "पुनर्वास और सुरक्षित आवास",
    psychiatricReferral: "नैदानिक मनोचिकित्सक परामर्श",
    legalAidEscort: "कानूनी गवाही सहायता",
    nhaaHelpline: "NHAA टोल-फ्री हेल्पलाइन: 14566",
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('saathi_lang') || 'en';
  });

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    localStorage.setItem('saathi_lang', nextLang);
  };

  const t = (key) => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
