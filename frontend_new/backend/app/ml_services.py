"""
ML services module — loads all models once at app startup.
No model reloading per request.
"""

import torch
import torch.nn as nn
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Wav2Vec2Model,
    Wav2Vec2FeatureExtractor,
)
import whisper
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"

INDICBERT_PATH = str(MODELS_DIR / "indicbert_5000")
VOICE_MODEL_PATH = str(MODELS_DIR / "speech_emotion" / "best_model.pt")

indicbert_model = None
indicbert_tokenizer = None
voice_stress_model = None
voice_stress_processor = None
voice_stress_label2id = None
voice_stress_id2label = None
whisper_model = None


class VoiceStressModel(nn.Module):
    """Custom wav2vec2-based emotion classifier (matches Vaibhav's checkpoint)."""
    def __init__(self, model_name, num_labels):
        super().__init__()
        self.encoder = Wav2Vec2Model.from_pretrained(model_name)
        self.classifier = nn.Sequential(
            nn.Linear(768, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_labels),
        )

    def forward(self, input_values):
        outputs = self.encoder(input_values)
        pooled = outputs.last_hidden_state.mean(dim=1)  # mean pooling
        logits = self.classifier(pooled)
        return logits


def load_all_models():
    global indicbert_model, indicbert_tokenizer
    global voice_stress_model, voice_stress_processor, voice_stress_label2id, voice_stress_id2label
    global whisper_model

    print("[ML] Loading IndicBERT model...")
    indicbert_tokenizer = AutoTokenizer.from_pretrained(INDICBERT_PATH)
    indicbert_model = AutoModelForSequenceClassification.from_pretrained(INDICBERT_PATH)
    indicbert_model.eval()
    print("[ML] ✓ IndicBERT loaded")

    print("[ML] Loading voice stress model...")
    checkpoint = torch.load(VOICE_MODEL_PATH, map_location="cpu")

    voice_stress_label2id = checkpoint['label2id']
    voice_stress_id2label = checkpoint['id2label']

    voice_stress_model = VoiceStressModel(
        checkpoint['model_name'],
        num_labels=len(voice_stress_label2id)
    )
    voice_stress_model.load_state_dict(checkpoint['model_state_dict'])
    voice_stress_model.eval()

    voice_stress_processor = Wav2Vec2FeatureExtractor.from_pretrained(checkpoint['model_name'])
    print("[ML] ✓ Voice stress model loaded")

    print("[ML] Loading Whisper model...")
    whisper_model = whisper.load_model("base")
    print("[ML] ✓ Whisper loaded")


def predict_text_emotion(text: str) -> float:
    if not indicbert_model:
        raise RuntimeError("IndicBERT model not loaded")

    inputs = indicbert_tokenizer(text, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = indicbert_model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=1)
        distress_prob = probabilities[0][1].item()
        expressed_distress = int(distress_prob * 100)

    return max(0, min(100, expressed_distress))


def predict_voice_stress(audio_path: str) -> float:
    if not voice_stress_model:
        raise RuntimeError("Voice stress model not loaded")

    import librosa

    try:
        y, sr = librosa.load(audio_path, sr=16000)
        inputs = voice_stress_processor(y, sampling_rate=16000, return_tensors="pt")

        with torch.no_grad():
            logits = voice_stress_model(inputs["input_values"])
            probs = torch.softmax(logits, dim=1)[0]

        stress_weights = {
            "anger": 0.9, "disgust": 0.7, "fear": 1.0,
            "sad": 0.8, "neutral": 0.2, "happy": 0.0,
        }

        stress_score = sum(
            probs[voice_stress_label2id[emotion]].item() * weight
            for emotion, weight in stress_weights.items()
        )

        return int(max(0, min(100, stress_score * 100)))
    except Exception as e:
        print(f"[ERROR] Voice stress prediction failed: {e}")
        return 50


def transcribe_audio(audio_path: str, language: str = "en") -> str:
    if not whisper_model:
        raise RuntimeError("Whisper model not loaded")

    try:
        result = whisper_model.transcribe(audio_path, language=language)
        return result["text"].strip()
    except Exception as e:
        print(f"[ERROR] Whisper transcription failed: {e}")
        return ""