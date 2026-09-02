import pandas as pd
import numpy as np
import torch
import time

from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)


# ============================================================
# SETTINGS
# ============================================================

DATASET_PATH = "combined_sentiment_full.parquet"

MODEL_NAME = "ai4bharat/IndicBERTv2-MLM-only"

TRAIN_SIZE = 0.85
TEST_SIZE = 0.15

RANDOM_SEED = 42

NUM_LABELS = 3

LABEL_NAMES = [
    "Negative",
    "Neutral",
    "Positive"
]


# ============================================================
# START TIMER
# ============================================================

total_start = time.time()

print("=" * 70)
print("INDICBERTV2 SENTIMENT TRAINING")
print("=" * 70)

print("Model:", MODEL_NAME)
print("Dataset:", DATASET_PATH)
print("Train:", "85%")
print("Test:", "15%")
print("Labels:", LABEL_NAMES)


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("\nDevice:", device)

if torch.cuda.is_available():

    print(
        "GPU:",
        torch.cuda.get_device_name(0)
    )

    print(
        "GPU Memory:",
        round(
            torch.cuda.get_device_properties(0).total_memory
            / (1024 ** 3),
            2
        ),
        "GB"
    )

else:

    print("WARNING: CUDA GPU not detected.")


# ============================================================
# LOAD DATASET
# ============================================================

print("\n" + "=" * 70)
print("LOADING DATASET")
print("=" * 70)

df = pd.read_parquet(
    DATASET_PATH
)

print(
    "Total rows:",
    len(df)
)

print(
    "\nColumns:",
    list(df.columns)
)


# ============================================================
# CLEAN DATA
# ============================================================

df = df[
    ["text", "label"]
].copy()

df["text"] = (
    df["text"]
    .astype(str)
    .str.strip()
)

df["label"] = pd.to_numeric(
    df["label"],
    errors="coerce"
)

df = df.dropna(
    subset=["text", "label"]
)

df["label"] = df["label"].astype(int)

df = df[
    df["label"].isin([0, 1, 2])
]

df = df[
    df["text"].str.len() > 0
]

print(
    "\nRows after cleaning:",
    len(df)
)


# ============================================================
# LABEL DISTRIBUTION
# ============================================================

print("\nFull dataset label distribution:")

print(
    df["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# 85 / 15 SPLIT
# ============================================================

print("\n" + "=" * 70)
print("CREATING 85/15 TRAIN-TEST SPLIT")
print("=" * 70)

train_df, test_df = train_test_split(
    df,
    test_size=TEST_SIZE,
    train_size=TRAIN_SIZE,
    random_state=RANDOM_SEED,
    stratify=df["label"]
)

train_df = train_df.reset_index(
    drop=True
)

test_df = test_df.reset_index(
    drop=True
)

print(
    "\nTraining samples:",
    len(train_df)
)

print(
    "Testing samples:",
    len(test_df)
)

print(
    "\nTraining percentage:",
    round(
        len(train_df) / len(df) * 100,
        2
    ),
    "%"
)

print(
    "Testing percentage:",
    round(
        len(test_df) / len(df) * 100,
        2
    ),
    "%"
)


# ============================================================
# VERIFY LABEL DISTRIBUTION
# ============================================================

print("\nTraining label distribution:")

print(
    train_df["label"]
    .value_counts()
    .sort_index()
)

print("\nTesting label distribution:")

print(
    test_df["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# SAVE SPLITS
# ============================================================

print("\nSaving train/test splits...")

train_df.to_parquet(
    "sentiment_train_85.parquet",
    index=False
)

test_df.to_parquet(
    "sentiment_test_15.parquet",
    index=False
)

print(
    "Saved sentiment_train_85.parquet"
)

print(
    "Saved sentiment_test_15.parquet"
)


# ============================================================
# CONVERT TO HF DATASETS
# ============================================================

train_dataset = Dataset.from_pandas(
    train_df,
    preserve_index=False
)

test_dataset = Dataset.from_pandas(
    test_df,
    preserve_index=False
)


# ============================================================
# TOKENIZER
# ============================================================

print("\n" + "=" * 70)
print("LOADING INDICBERTV2")
print("=" * 70)

print(
    "Loading tokenizer..."
)

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME
)


# ============================================================
# TOKENIZATION
# ============================================================

MAX_LENGTH = 128

print(
    "\nTokenizing training dataset..."
)

def tokenize_function(examples):

    return tokenizer(
        examples["text"],
        truncation=True,
        max_length=MAX_LENGTH,
        padding=False
    )


train_dataset = train_dataset.map(
    tokenize_function,
    batched=True,
    batch_size=1000,
    desc="Tokenizing train"
)

print(
    "Tokenizing test dataset..."
)

test_dataset = test_dataset.map(
    tokenize_function,
    batched=True,
    batch_size=1000,
    desc="Tokenizing test"
)


# ============================================================
# MODEL
# ============================================================

print("\nLoading model...")

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=NUM_LABELS,
    ignore_mismatched_sizes=True
)

model.config.id2label = {
    0: "Negative",
    1: "Neutral",
    2: "Positive"
}

model.config.label2id = {
    "Negative": 0,
    "Neutral": 1,
    "Positive": 2
}

model.to(device)


# ============================================================
# METRICS
# ============================================================

def compute_metrics(eval_pred):

    predictions, labels = eval_pred

    predictions = np.argmax(
        predictions,
        axis=1
    )

    accuracy = accuracy_score(
        labels,
        predictions
    )

    precision, recall, f1, _ = (
        precision_recall_fscore_support(
            labels,
            predictions,
            average="macro",
            zero_division=0
        )
    )

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1
    }


# ============================================================
# TRAINING ARGUMENTS
# ============================================================

training_args = TrainingArguments(

    output_dir="./indicbert_results",

    num_train_epochs=1,

    per_device_train_batch_size=16,

    per_device_eval_batch_size=32,

    gradient_accumulation_steps=2,

    learning_rate=2e-5,

    weight_decay=0.01,

    warmup_ratio=0.1,

    logging_steps=500,

    eval_strategy="steps",

    eval_steps=5000,

    save_strategy="steps",

    save_steps=5000,

    save_total_limit=2,

    load_best_model_at_end=True,

    metric_for_best_model="f1",

    greater_is_better=True,

    fp16=torch.cuda.is_available(),

    report_to="none",

    seed=RANDOM_SEED
)


# ============================================================
# TRAINER
# ============================================================

trainer = Trainer(

    model=model,

    args=training_args,

    train_dataset=train_dataset,

    eval_dataset=test_dataset,

    processing_class=tokenizer,

    compute_metrics=compute_metrics
)


# ============================================================
# TRAIN
# ============================================================

print("\n" + "=" * 70)
print("STARTING TRAINING")
print("=" * 70)

train_start = time.time()

trainer.train()

train_time = time.time() - train_start

print(
    "\nTraining time:",
    round(train_time / 60, 2),
    "minutes"
)


# ============================================================
# FINAL TEST EVALUATION
# ============================================================

print("\n" + "=" * 70)
print("FINAL TEST EVALUATION")
print("=" * 70)

test_start = time.time()

results = trainer.evaluate(
    test_dataset
)

test_time = time.time() - test_start

print("\nTest results:")

for key, value in results.items():

    if isinstance(value, float):

        print(
            key,
            ":",
            round(value, 4)
        )

    else:

        print(
            key,
            ":",
            value
        )


# ============================================================
# DETAILED PREDICTIONS
# ============================================================

print("\nGenerating predictions...")

prediction_output = trainer.predict(
    test_dataset
)

predictions = np.argmax(
    prediction_output.predictions,
    axis=1
)

true_labels = (
    test_df["label"]
    .values
)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\n" + "=" * 70)
print("CLASSIFICATION REPORT")
print("=" * 70)

report = classification_report(
    true_labels,
    predictions,
    labels=[0, 1, 2],
    target_names=LABEL_NAMES,
    digits=4,
    zero_division=0
)

print(report)


# ============================================================
# CONFUSION MATRIX
# ============================================================

print("\n" + "=" * 70)
print("CONFUSION MATRIX")
print("=" * 70)

cm = confusion_matrix(
    true_labels,
    predictions,
    labels=[0, 1, 2]
)

print(
    pd.DataFrame(
        cm,
        index=[
            "True Negative",
            "True Neutral",
            "True Positive"
        ],
        columns=[
            "Pred Negative",
            "Pred Neutral",
            "Pred Positive"
        ]
    )
)


# ============================================================
# SAVE PREDICTIONS
# ============================================================

prediction_df = test_df.copy()

prediction_df["prediction"] = predictions

prediction_df["true_label_name"] = (
    prediction_df["label"]
    .map({
        0: "Negative",
        1: "Neutral",
        2: "Positive"
    })
)

prediction_df["predicted_label_name"] = (
    prediction_df["prediction"]
    .map({
        0: "Negative",
        1: "Neutral",
        2: "Positive"
    })
)

prediction_df.to_parquet(
    "indicbert_test_predictions.parquet",
    index=False
)


# ============================================================
# SAVE MODEL
# ============================================================

print("\nSaving final model...")

trainer.save_model(
    "./indicbert_final_model"
)

tokenizer.save_pretrained(
    "./indicbert_final_model"
)


# ============================================================
# FINAL SUMMARY
# ============================================================

total_time = time.time() - total_start

accuracy = accuracy_score(
    true_labels,
    predictions
)

precision, recall, f1, _ = (
    precision_recall_fscore_support(
        true_labels,
        predictions,
        average="macro",
        zero_division=0
    )
)

print("\n" + "=" * 70)
print("FINAL RESULTS")
print("=" * 70)

print(
    f"Total dataset: {len(df):,}"
)

print(
    f"Training samples: {len(train_df):,}"
)

print(
    f"Testing samples: {len(test_df):,}"
)

print(
    f"Accuracy: {accuracy:.4f}"
)

print(
    f"Macro Precision: {precision:.4f}"
)

print(
    f"Macro Recall: {recall:.4f}"
)

print(
    f"Macro F1: {f1:.4f}"
)

print(
    f"Training time: {train_time / 60:.2f} minutes"
)

print(
    f"Test inference time: {test_time / 60:.2f} minutes"
)

print(
    f"Total runtime: {total_time / 60:.2f} minutes"
)

print("\nFiles created:")

print(
    "sentiment_train_85.parquet"
)

print(
    "sentiment_test_15.parquet"
)

print(
    "indicbert_test_predictions.parquet"
)

print(
    "indicbert_final_model/"
)

print("\nDONE!")