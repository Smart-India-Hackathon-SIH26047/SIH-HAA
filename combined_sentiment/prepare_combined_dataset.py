import pandas as pd
import numpy as np
from pathlib import Path
from datasets import load_dataset
import pyarrow as pa
import pyarrow.parquet as pq
import os

# ============================================================
# SETTINGS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

OUTPUT_FILE = BASE_DIR / "combined_sentiment_full.parquet"
SUMMARY_FILE = BASE_DIR / "combined_sentiment_summary.csv"

SEED = 42

# Common labels:
# 0 = Negative
# 1 = Neutral
# 2 = Positive


# ============================================================
# HELPER
# ============================================================

def clean_text(x):
    if pd.isna(x):
        return ""

    x = str(x).strip()
    x = " ".join(x.split())

    return x


def clean_local_dataframe(df):
    df = df.copy()

    df["text"] = df["text"].apply(clean_text)

    df = df[df["text"].str.len() > 0]

    df = df.drop_duplicates(
        subset=["text"]
    )

    return df


# ============================================================
# STORAGE
# ============================================================

writer = None
total_rows = 0
summary_data = []


def write_dataframe(df):
    global writer
    global total_rows

    if len(df) == 0:
        return

    df = df[
        ["text", "label", "dataset"]
    ]

    table = pa.Table.from_pandas(
        df,
        preserve_index=False
    )

    if writer is None:
        writer = pq.ParquetWriter(
            OUTPUT_FILE,
            table.schema,
            compression="snappy"
        )

    writer.write_table(table)

    total_rows += len(df)

    print(
        f"Written {len(df):,} rows | "
        f"Total: {total_rows:,}"
    )


# ============================================================
# 1. INDICVARNA-100K
# ============================================================

print("\n" + "=" * 70)
print("1/5 INDICVARNA-100K")
print("=" * 70)

indic_path = BASE_DIR / "0000.parquet"

indic = pd.read_parquet(indic_path)

print("Original rows:", len(indic))
print("Columns:", list(indic.columns))

indic["text"] = indic["text"].apply(clean_text)
indic["label"] = pd.to_numeric(
    indic["label"],
    errors="coerce"
)

indic = indic.dropna(
    subset=["text", "label"]
)

indic["label"] = indic["label"].astype(int)

indic = indic[
    indic["label"].isin([0, 1, 2])
]

indic = clean_local_dataframe(indic)

indic["dataset"] = "IndicVarna-100k"

print("\nIndicVarna label distribution:")
print(
    indic["label"]
    .value_counts()
    .sort_index()
)

write_dataframe(indic)


# ============================================================
# 2. TAMILMIXSENTIMENT
# ============================================================

print("\n" + "=" * 70)
print("2/5 TAMILMIXSENTIMENT")
print("=" * 70)

tamil_files = [
    BASE_DIR / "tamilmixsentiment_train.csv",
    BASE_DIR / "tamilmixsentiment_validation.csv",
    BASE_DIR / "tamilmixsentiment_test.csv"
]

tamil_parts = []

for file in tamil_files:

    df = pd.read_csv(file)

    print(
        file.name,
        "->",
        len(df),
        "rows"
    )

    tamil_parts.append(df)

tamil = pd.concat(
    tamil_parts,
    ignore_index=True
)

print("Original Tamil rows:", len(tamil))

print("\nOriginal Tamil labels:")
print(
    tamil["label"]
    .value_counts()
    .sort_index()
)

tamil["text"] = tamil["text"].apply(clean_text)

tamil["label"] = pd.to_numeric(
    tamil["label"],
    errors="coerce"
)

# TamilMixSentiment:
#
# 0 = Positive
# 1 = Negative
# 2 = Mixed feelings
# 3 = Unknown
# 4 = Not Tamil
#
# Keep only Positive + Negative.
#
# Common labels:
# Positive -> 2
# Negative -> 0

tamil = tamil[
    tamil["label"].isin([0, 1])
].copy()

tamil["label"] = tamil["label"].map({
    0: 2,
    1: 0
})

tamil = clean_local_dataframe(tamil)

tamil["dataset"] = "TamilMixSentiment"

print("\nClean Tamil rows:", len(tamil))

print(
    tamil["label"]
    .value_counts()
    .sort_index()
)

write_dataframe(tamil)


# ============================================================
# 3. SENTNOB
# ============================================================

print("\n" + "=" * 70)
print("3/5 SENTNOB")
print("=" * 70)

sentnob_path = BASE_DIR / "sentnob_train.csv"

sentnob = pd.read_csv(
    sentnob_path
)

print("Original rows:", len(sentnob))
print("Columns:", list(sentnob.columns))

sentnob = sentnob.rename(
    columns={
        "Data": "text",
        "Label": "label"
    }
)

sentnob["text"] = sentnob["text"].apply(clean_text)

sentnob["label"] = pd.to_numeric(
    sentnob["label"],
    errors="coerce"
)

sentnob = sentnob.dropna(
    subset=["text", "label"]
)

sentnob["label"] = sentnob["label"].astype(int)

# SentNoB:
#
# 0 = Neutral
# 1 = Positive
# 2 = Negative
#
# Common:
# Neutral -> 1
# Positive -> 2
# Negative -> 0

sentnob = sentnob[
    sentnob["label"].isin([0, 1, 2])
]

sentnob["label"] = sentnob["label"].map({
    0: 1,
    1: 2,
    2: 0
})

sentnob = clean_local_dataframe(
    sentnob
)

sentnob["dataset"] = "SentNoB"

print("Clean SentNoB rows:", len(sentnob))

print(
    sentnob["label"]
    .value_counts()
    .sort_index()
)

write_dataframe(sentnob)


# ============================================================
# 4. MALAYALAM MIX SENTIMENT
# ============================================================

print("\n" + "=" * 70)
print("4/5 MALAYALAM MIX SENTIMENT")
print("=" * 70)

mal_path = (
    BASE_DIR /
    "Malayalam_first_ready_for_sentiment.tsv"
)

mal = pd.read_csv(
    mal_path,
    sep="\t",
    encoding="utf-8"
)

print("Original rows:", len(mal))
print("Columns:", list(mal.columns))

# Detect text column
text_candidates = [
    "text",
    "Text",
    "sentence",
    "Sentence",
    "comment",
    "Comment",
    "Data",
    "data"
]

# Detect label column
label_candidates = [
    "label",
    "Label",
    "sentiment",
    "Sentiment",
    "category",
    "Category"
]

text_col = None
label_col = None

for col in text_candidates:
    if col in mal.columns:
        text_col = col
        break

for col in label_candidates:
    if col in mal.columns:
        label_col = col
        break

if text_col is None:
    text_col = mal.columns[0]

if label_col is None:
    label_col = mal.columns[-1]

print("Text column:", text_col)
print("Label column:", label_col)

mal = mal.rename(
    columns={
        text_col: "text",
        label_col: "original_label"
    }
)

mal["text"] = mal["text"].apply(clean_text)


def map_malayalam_label(value):

    if pd.isna(value):
        return np.nan

    s = str(value).strip().lower()

    # Positive
    if "positive" in s:
        return 2

    # Negative
    if "negative" in s:
        return 0

    # Neutral
    if "neutral" in s:
        return 1

    # Unknown / mixed / not Malayalam
    return np.nan


mal["label"] = mal[
    "original_label"
].apply(
    map_malayalam_label
)

mal = mal.dropna(
    subset=["text", "label"]
)

mal["label"] = mal["label"].astype(int)

mal = clean_local_dataframe(
    mal
)

mal["dataset"] = "MalayalamMixSentiment"

print("Clean Malayalam rows:", len(mal))

print(
    mal["label"]
    .value_counts()
    .sort_index()
)

write_dataframe(mal)


# ============================================================
# 5. FULL INDISENTIMENT140
# ============================================================

print("\n" + "=" * 70)
print("5/5 FULL INDISENTIMENT140")
print("=" * 70)

print(
    "Loading full IndiSentiment140 dataset..."
)

indi140 = load_dataset(
    "saurabh1003/IndiSentiment140",
    split="train"
)

print(
    "Total IndiSentiment140 rows:",
    len(indi140)
)

print(
    "Columns:",
    indi140.column_names
)


# ============================================================
# PROCESS IN CHUNKS
# ============================================================

CHUNK_SIZE = 100_000

indi140_total = len(indi140)

for start in range(
    0,
    indi140_total,
    CHUNK_SIZE
):

    end = min(
        start + CHUNK_SIZE,
        indi140_total
    )

    print(
        f"\nProcessing IndiSentiment140 "
        f"{start:,} - {end:,} "
        f"of {indi140_total:,}"
    )

    chunk = indi140.select(
        range(start, end)
    )

    chunk_df = chunk.to_pandas()

    # Original Sentiment140:
    #
    # 0 = Negative
    # 4 = Positive
    #
    # No neutral class.
    #
    # Common:
    # 0 -> Negative
    # 4 -> Positive

    chunk_df["label"] = (
        pd.to_numeric(
            chunk_df["sentiment"],
            errors="coerce"
        )
    )

    chunk_df = chunk_df[
        chunk_df["label"].isin([0, 4])
    ].copy()

    chunk_df["label"] = chunk_df[
        "label"
    ].map({
        0: 0,
        4: 2
    })

    chunk_df["text"] = (
        chunk_df["text"]
        .apply(clean_text)
    )

    chunk_df = chunk_df[
        chunk_df["text"].str.len() > 0
    ]

    chunk_df = chunk_df[
        ["text", "label"]
    ]

    chunk_df["dataset"] = (
        "IndiSentiment140"
    )

    write_dataframe(
        chunk_df
    )

    del chunk_df
    del chunk


# ============================================================
# CLOSE PARQUET
# ============================================================

if writer is not None:

    writer.close()

print("\n" + "=" * 70)
print("COMBINATION COMPLETE")
print("=" * 70)

print(
    f"Total rows written: {total_rows:,}"
)

print(
    f"Output file:\n{OUTPUT_FILE}"
)

print(
    "\nIMPORTANT:"
)

print(
    "IndiSentiment140 contains only "
    "Negative and Positive labels."
)

print(
    "No artificial Neutral labels were created."
)

print(
    "\nFinal common label scheme:"
)

print(
    "0 = Negative"
)

print(
    "1 = Neutral"
)

print(
    "2 = Positive"
)

print("\nDONE!")