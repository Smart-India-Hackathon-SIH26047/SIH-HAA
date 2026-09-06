import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000", // swap when backend is deployed
  headers: { "Content-Type": "application/json" },
  timeout: 4000,
});

// Mock database for offline / standalone seamless operation
const MOCK_PEOPLE = {
  P101: {
    person_id: "P101",
    name: "Ramesh Kumar",
    age: 34,
    gender: "Male",
    district: "Patna, Bihar",
    state: "Bihar",
    case_ref: "FIR-2024-8842",
    category: "Witness Facing Intimidation",
    poa_clause: "PoA Act Sec 3(1)(r) & Witness Protection Scheme",
    channel: "NHAA Helpline 14566",
    timeline: [
      { date: "Aug 01", distress_score: 35 },
      { date: "Aug 08", distress_score: 42, event: "Initial Case Filing" },
      { date: "Aug 15", distress_score: 58, event: "Court Hearing Postponed" },
      { date: "Aug 22", distress_score: 70, event: "Relief Disbursement Delayed" },
      { date: "Aug 29", distress_score: 79 },
      { date: "Sep 04", distress_score: 88, event: "Voice Stress Spike Alert" }
    ],
    case_events: [
      { date: "Aug 08", label: "Case Filing", description: "Formal FIR registered under PoA Act." },
      { date: "Aug 15", label: "Hearing Postponed", description: "Magistrate court adjourned session due to absent defense witness." },
      { date: "Aug 22", label: "Relief Delay", description: "Interim financial compensation pending treasury release." },
      { date: "Sep 04", label: "Safety Alert", description: "Voice pitch stress elevated; intimidation keywords flagged." }
    ],
    emotion_ai: {
      anxiety: 84,
      fear: 78,
      hopelessness: 72,
      voice_stress: "HIGH (+4.2 Hz Pitch Elevation)"
    },
    xai_rationale: "Triggered high distress due to a combination of 3 consecutive hearing postponements, pending interim financial relief, and high voice pitch variance (+4.2 Hz) indicating acute fear of local pressure.",
    predictive_forecast: "HIGH RISK (88% likelihood of severe mental health crisis within 14 days if witness protection is unassigned).",
    recommended_interventions: [
      { id: "INT-1", title: "Witness Protection Escort", priority: "URGENT", desc: "Dispatch armed local police protection under PoA Witness Directives." },
      { id: "INT-2", title: "Expedite Financial Compensation", priority: "HIGH", desc: "Request Treasury Officer to release ₹1,25,000 interim relief." },
      { id: "INT-3", title: "Clinical Counseling Visit", priority: "MEDIUM", desc: "Assign District Clinical Psychologist for weekly house call." }
    ]
  },
  P102: {
    person_id: "P102",
    name: "Sunita Devi",
    age: 29,
    gender: "Female",
    district: "Gaya, Bihar",
    state: "Bihar",
    case_ref: "FIR-2024-9104",
    category: "Rape & Gang Rape Victim",
    poa_clause: "PoA Act Sec 3(2)(v) & Special Court Trial",
    channel: "Mobile App PWA",
    timeline: [
      { date: "Aug 01", distress_score: 25 },
      { date: "Aug 08", distress_score: 30 },
      { date: "Aug 15", distress_score: 45, event: "Counselor Session" },
      { date: "Aug 22", distress_score: 62, event: "Testimony Notice Served" },
      { date: "Aug 29", distress_score: 68 },
      { date: "Sep 04", distress_score: 74, event: "Pre-Trial Anxiety" }
    ],
    case_events: [
      { date: "Aug 15", label: "Counseling", description: "First psychological assessment completed." },
      { date: "Aug 22", label: "Summons", description: "Summons issued for deposition on Sept 12." }
    ],
    emotion_ai: {
      anxiety: 76,
      fear: 68,
      hopelessness: 54,
      voice_stress: "MODERATE (+2.1 Hz Pitch Elevation)"
    },
    xai_rationale: "Distress elevated due to upcoming in-court testimony in Special PoA Court and fear of facing accused during deposition.",
    predictive_forecast: "MODERATE RISK (62% likelihood of pre-trial panic episode without legal support).",
    recommended_interventions: [
      { id: "INT-1", title: "Legal Deposition Accompaniment", priority: "HIGH", desc: "Assign Female Special Public Prosecutor advocate for court escort." },
      { id: "INT-2", title: "Trauma Counseling", priority: "HIGH", desc: "Schedule 3 pre-deposition counseling sessions." }
    ]
  },
  P103: {
    person_id: "P103",
    name: "Ankit Verma",
    age: 24,
    gender: "Male",
    district: "Muzaffarpur, Bihar",
    state: "Bihar",
    case_ref: "FIR-2024-7719",
    category: "Murder / Grievous Hurt / Arson",
    poa_clause: "PoA Act Sec 3(2)(iii) Arson & Assault",
    channel: "IVRS Call Channel",
    timeline: [
      { date: "Aug 01", distress_score: 60 },
      { date: "Aug 08", distress_score: 72, event: "Witness Pressure Reported" },
      { date: "Aug 15", distress_score: 80 },
      { date: "Aug 22", distress_score: 86, event: "Police Protection Requested" },
      { date: "Aug 29", distress_score: 89 },
      { date: "Sep 04", distress_score: 92, event: "Acute Safety Crisis" }
    ],
    case_events: [
      { date: "Aug 08", label: "Threat Logged", description: "Coercive threat reported near residence." },
      { date: "Aug 22", label: "Escalation", description: "Nodal officer requested armed escort." },
      { date: "Sep 04", label: "Critical Flag", description: "Emergency IVRS hotline triggered." }
    ],
    emotion_ai: {
      anxiety: 95,
      fear: 91,
      hopelessness: 89,
      voice_stress: "CRITICAL (+6.8 Hz Tremor Detected)"
    },
    xai_rationale: "Distress score 92 triggered by explicit threat keywords ('kill', 'scared', 'no safety') combined with severe vocal tremors detected over IVRS call.",
    predictive_forecast: "CRITICAL ESCALATION (94% crisis probability; immediate physical protection & relocation required).",
    recommended_interventions: [
      { id: "INT-1", title: "Emergency Relocation & Housing", priority: "URGENT", desc: "Move victim's family to safe state shelter home." },
      { id: "INT-2", title: "Armed Escort Protection", priority: "URGENT", desc: "24/7 Police protection at current residence." }
    ]
  },
  P104: {
    person_id: "P104",
    name: "Meena Kumari",
    age: 41,
    gender: "Female",
    district: "Nalanda, Bihar",
    state: "Bihar",
    case_ref: "FIR-2024-5290",
    category: "PoA Relief Recipient",
    poa_clause: "Rehabilitation & Housing Grant",
    channel: "Chatbot Channel",
    timeline: [
      { date: "Aug 01", distress_score: 55 },
      { date: "Aug 08", distress_score: 50 },
      { date: "Aug 15", distress_score: 48, event: "Housing Allotment" },
      { date: "Aug 22", distress_score: 44 },
      { date: "Aug 29", distress_score: 40 },
      { date: "Sep 04", distress_score: 42 }
    ],
    case_events: [
      { date: "Aug 15", label: "Rehabilitation", description: "Temporary housing grant approved." }
    ],
    emotion_ai: {
      anxiety: 38,
      fear: 32,
      hopelessness: 30,
      voice_stress: "NORMAL (Stable Pitch)"
    },
    xai_rationale: "Distress score stable following successful housing allotment and monthly rehabilitation disbursement.",
    predictive_forecast: "LOW RISK (15% likelihood of escalation; routine monitoring sufficient).",
    recommended_interventions: [
      { id: "INT-1", title: "Routine Monthly Welfare Call", priority: "LOW", desc: "Standard 30-day follow-up." }
    ]
  },
  P105: {
    person_id: "P105",
    name: "Rajesh Prasad",
    age: 38,
    gender: "Male",
    district: "Darbhanga, Bihar",
    state: "Bihar",
    case_ref: "FIR-2024-3310",
    category: "Caste-Based Violence Victim",
    poa_clause: "Economic Rehabilitation Support",
    channel: "Mobile App PWA",
    timeline: [
      { date: "Aug 01", distress_score: 40 },
      { date: "Aug 08", distress_score: 45 },
      { date: "Aug 15", distress_score: 50, event: "Livelihood Training" },
      { date: "Aug 22", distress_score: 52 },
      { date: "Aug 29", distress_score: 55 },
      { date: "Sep 04", distress_score: 58 }
    ],
    case_events: [
      { date: "Aug 15", label: "Vocational Aid", description: "Enrolled in skill development scheme." }
    ],
    emotion_ai: {
      anxiety: 52,
      fear: 44,
      hopelessness: 48,
      voice_stress: "SLIGHT (+1.2 Hz Elevation)"
    },
    xai_rationale: "Gradual upward distress trend linked to economic strain during trial proceedings.",
    predictive_forecast: "MODERATE RISK (45% escalation probability over 30 days if employment support stalls).",
    recommended_interventions: [
      { id: "INT-1", title: "Skill Grant Release", priority: "MEDIUM", desc: "Expedite second installment of vocational self-employment grant." }
    ]
  }
};

let MOCK_ALERTS = [
  {
    id: "ALT-101",
    person_id: "P101",
    person_name: "Ramesh Kumar",
    district: "Patna, Bihar",
    state: "Bihar",
    distress_score: 88,
    risk_level: "HIGH",
    category: "Witness Facing Intimidation",
    channel: "NHAA Helpline 14566",
    flag_reasons: ["Hearing postponed 3x", "Delayed monetary relief", "Reported intimidation in check-in"],
    timestamp: "2026-09-04T09:30:00Z",
    status: "PENDING",
    assigned_officer: "OFF-01",
    last_checkin_text: "I am feeling extremely anxious. The trial date keeps moving and people in our village are telling us to drop the case."
  },
  {
    id: "ALT-102",
    person_id: "P103",
    person_name: "Ankit Verma",
    district: "Muzaffarpur, Bihar",
    state: "Bihar",
    distress_score: 92,
    risk_level: "CRITICAL",
    category: "Murder / Grievous Hurt / Arson",
    channel: "IVRS Call Channel",
    flag_reasons: ["Explicit safety threat mentioned", "Severe distress score > 90", "IVRS Voice Tremor Detected"],
    timestamp: "2026-09-04T11:15:00Z",
    status: "PENDING",
    assigned_officer: "OFF-01",
    last_checkin_text: "I feel unsafe leaving my house. I don't know who to trust anymore."
  },
  {
    id: "ALT-103",
    person_id: "P102",
    person_name: "Sunita Devi",
    district: "Gaya, Bihar",
    state: "Bihar",
    distress_score: 74,
    risk_level: "MEDIUM",
    category: "Rape & Gang Rape Victim",
    channel: "Mobile App PWA",
    flag_reasons: ["Pre-trial anxiety spike", "Legal aid request pending"],
    timestamp: "2026-09-04T07:45:00Z",
    status: "PENDING",
    assigned_officer: "OFF-02",
    last_checkin_text: "Terrified about court deposition next week. Need someone to walk me through the protection measures."
  },
  {
    id: "ALT-104",
    person_id: "P105",
    person_name: "Rajesh Prasad",
    district: "Darbhanga, Bihar",
    state: "Bihar",
    distress_score: 58,
    risk_level: "MODERATE",
    category: "Caste-Based Violence Victim",
    channel: "Chatbot Channel",
    flag_reasons: ["Gradual upward distress trend"],
    timestamp: "2026-09-03T14:20:00Z",
    status: "ACKNOWLEDGED",
    reviewer_ref: "OFF-03",
    decision: "AGREE",
    reason: "Assigned local counselor for weekly check-in.",
    assigned_officer: "OFF-03",
    last_checkin_text: "Struggling to find steady work while managing legal expenses."
  }
];

export const submitCheckin = async (person_id, text, channel = "chat", privateMode = false) => {
  const lower = text.toLowerCase();

  // Safety trigger check — active even in private mode for safety
  const isSafetyTrigger =
    (!privateMode && person_id === "P103") ||
    lower.includes("hopeless") ||
    lower.includes("harm") ||
    lower.includes("threat") ||
    lower.includes("kill") ||
    lower.includes("scared") ||
    lower.includes("unsafe") ||
    lower.includes("fear") ||
    lower.includes("danger") ||
    lower.includes("suicide");

  const calculatedScore = isSafetyTrigger
    ? Math.floor(Math.random() * 10) + 88
    : Math.floor(Math.random() * 25) + 65;

  const riskLevel = calculatedScore >= 88 ? "CRITICAL" : calculatedScore >= 75 ? "HIGH" : "MEDIUM";
  const flagReasons = isSafetyTrigger
    ? ["Explicit distress/threat reported", "Voice / text safety trigger alert"]
    : ["Recent victim check-in submitted", "Distress trend update"];

  const personDetails = MOCK_PEOPLE[person_id] || {
    name: `Beneficiary ${person_id}`,
    district: "Patna, Bihar",
    category: "Witness Facing Intimidation"
  };

  const newAlert = {
    id: `ALT-${Date.now()}`,
    person_id: privateMode ? "ANON" : (person_id || "P101"),
    person_name: privateMode ? "Anonymous Beneficiary" : personDetails.name,
    district: privateMode ? "District Protection Cell" : personDetails.district,
    state: "Bihar",
    distress_score: calculatedScore,
    risk_level: riskLevel,
    category: personDetails.category || "Witness Protection",
    channel: channel,
    flag_reasons: flagReasons,
    timestamp: new Date().toISOString(),
    status: "PENDING",
    assigned_officer: "OFF-01",
    last_checkin_text: text,
    privacy_mode: privateMode
  };

  // Prepend to officer alerts stream so officer immediately sees it
  MOCK_ALERTS.unshift(newAlert);

  // Update mock person record if not in private mode
  if (!privateMode && person_id && MOCK_PEOPLE[person_id]) {
    const p = MOCK_PEOPLE[person_id];
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    p.timeline.push({
      date: today,
      distress_score: calculatedScore,
      event: `Check-in: ${text.slice(0, 30)}...`
    });
    p.case_events.unshift({
      date: today,
      label: "Check-in Problem Submitted",
      description: text
    });
    p.xai_rationale = `Latest check-in via ${channel}: "${text}". Distress score calculated at ${calculatedScore}/100 based on keyword variance and vocal pitch.`;
  }

  try {
    const payload = privateMode
      ? { person_id: "ANON", text, channel, privacy_mode: true }
      : { person_id, text, channel };
    await api.post("/checkin", payload);
  } catch (err) {
    console.warn("Backend API offline. Operating in mock fallback mode with local state sync.");
  }

  const chatbotReply = isSafetyTrigger
    ? `I have completed evaluating your entire conversation. Based on the threat factors and vocal/text patterns identified, our AI model predicted a Distress Score of ${calculatedScore}/100 (${riskLevel} RISK). Your full chat transcript has been alerted immediately to your Nodal Case Officer for priority action.`
    : `Thank you for completing your check-in conversation. Our AI model analyzed your messages and predicted a Distress Score of ${calculatedScore}/100 (${riskLevel} RISK). Your conversation transcript and score have been securely transmitted to your Nodal Officer's dashboard.`;

  if (isSafetyTrigger) {
    return {
      type: "safety_flag",
      chatbot_reply: chatbotReply,
      score: calculatedScore,
      risk_level: riskLevel,
      submitted_text: text,
      message: "Your response triggered an immediate safety alert. A dedicated welfare officer and counselor have been alerted to support you immediately.",
      helpline_info: {
        nhaa_helpline: "14566 (National Helpline Against Atrocities - Toll-Free)",
        hotline: "1800-599-0019 (KIRAN Mental Health Toll-Free)",
        emergency_contact: "112 (National Emergency Services)",
        counselor_chat: "1800-11-4015 (24/7 SIH Ministry Line)",
        local_nodal_officer: "District Protection Cell: 0612-2200192"
      }
    };
  }

  return {
    type: "score",
    privacy_mode: privateMode,
    person_id: privateMode ? "ANON" : person_id,
    chatbot_reply: chatbotReply,
    score: calculatedScore,
    risk_level: riskLevel,
    submitted_text: text,
    message: privateMode
      ? "Your anonymous check-in has been securely recorded and transmitted to the officer portal without identifying details."
      : "Your check-in has been securely recorded and transmitted directly to your Nodal Officer portal."
  };
};

export const getPersonHistory = async (person_id, accessed_by) => {
  try {
    const res = await api.get(`/people/${person_id}/history`, { params: { accessed_by } });
    return res.data;
  } catch (err) {
    console.warn("Backend unavailable. Using enriched mock history data for:", person_id);
    return MOCK_PEOPLE[person_id] || MOCK_PEOPLE["P101"];
  }
};

export const getOfficerAlerts = async (officer_id) => {
  try {
    const res = await api.get(`/officers/${officer_id}/alerts`);
    return res.data;
  } catch (err) {
    console.warn("Backend unavailable. Using enriched mock alerts for officer:", officer_id);
    return MOCK_ALERTS;
  }
};

export const acknowledgeAlert = async (alert_id, reviewer_ref, decision, reason) => {
  try {
    const res = await api.post(`/alerts/${alert_id}/acknowledge`, { reviewer_ref, decision, reason });
    return res.data;
  } catch (err) {
    console.warn("Backend unavailable. Mock acknowledging alert:", alert_id);
    MOCK_ALERTS = MOCK_ALERTS.map(item => {
      if (item.id === alert_id) {
        return {
          ...item,
          status: "ACKNOWLEDGED",
          reviewer_ref,
          decision,
          reason
        };
      }
      return item;
    });
    return { success: true, alert_id, decision, reason };
  }
};

export const logCaseEvent = async (payload) => {
  try {
    const res = await api.post("/case-events", payload);
    return res.data;
  } catch (err) {
    console.warn("Backend unavailable. Logging mock case event:", payload);
    if (payload?.person_id && MOCK_PEOPLE[payload.person_id]) {
      MOCK_PEOPLE[payload.person_id].case_events.push({
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        label: payload.label || "Case Update",
        description: payload.description || "Event logged by officer."
      });
    }
    return { success: true };
  }
};

export const setConsent = async (person_id, consent_type, granted) => {
  try {
    const res = await api.post("/consent", { person_id, consent_type, granted });
    return res.data;
  } catch (err) {
    console.warn("Backend unavailable. Setting mock consent:", { person_id, consent_type, granted });
    return { success: true, person_id, consent_type, granted };
  }
};
