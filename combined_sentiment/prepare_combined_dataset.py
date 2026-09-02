import os
import re
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 0000.parquet is one folder above combined_sentiment
INDICVARNA_FILE = os.path.join(
    BASE_DIR,
    "0000.parquet"
)

TAMIL_TRAIN = os.path.join(
    BASE_DIR,
    "tamilmixsentiment_train.csv"
)

TAMIL_VAL = os.path.join(
    BASE_DIR,
    "tamilmixsentiment_validation.csv"
)

TAMIL_TEST = os.path.join(
    BASE_DIR,
    "tamilmixsentiment_test.csv"
)

SENTNOB_TRAIN = os.path.join(
    BASE_DIR,
    "sentnob_train.csv"
)

INDISENTIMENT_FILE = os.path.join(
    BASE_DIR,
    "indisentiment140_sample.csv"
)

MALAYALAM_FILE = os.path.join(
    BASE_DIR,
    "Malayalam_first_ready_for_sentiment.tsv"
)

RANDOM_SEED = 42

TEST_SIZE = 0.15


# ============================================================
# HEADER
# ============================================================

print("=" * 75)
print("COMBINING 5 INDIAN-LANGUAGE SENTIMENT DATASETS")
print("=" * 75)

print()

print("Target labels:")
print("0 = Negative")
print("1 = Neutral")
print("2 = Positive")

print()


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def find_text_column(df):
    """
    Automatically find likely text column.
    """

    possible = [
        "text",
        "Text",
        "TEXT",
        "sentence",
        "Sentence",
        "comment",
        "Comment",
        "tweet",
        "Tweet",
        "content",
        "Content"
    ]

    for col in possible:
        if col in df.columns:
            return col

    # fallback: choose object/string column with longest average text
    string_columns = []

    for col in df.columns:

        if df[col].dtype == "object":

            try:
                avg_length = (
                    df[col]
                    .astype(str)
                    .str.len()
                    .mean()
                )

                string_columns.append(
                    (col, avg_length)
                )

            except:
                pass

    if string_columns:

        string_columns.sort(
            key=lambda x: x[1],
            reverse=True
        )

        return string_columns[0][0]

    return None


def find_label_column(df):
    """
    Automatically find likely label/sentiment column.
    """

    possible = [
        "label",
        "Label",
        "LABEL",
        "sentiment",
        "Sentiment",
        "SENTIMENT",
        "emotion",
        "Emotion",
        "class",
        "Class",
        "polarity",
        "Polarity"
    ]

    for col in possible:

        if col in df.columns:
            return col

    return None


def clean_text(text):

    if pd.isna(text):
        return ""

    text = str(text)

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


def normalize_string_label(value):

    if pd.isna(value):
        return None

    value = str(value).strip().lower()

    value = value.replace(
        "-",
        "_"
    )

    value = value.replace(
        " ",
        "_"
    )

    return value


# ============================================================
# DATASET 1 — INDICVARNA
# ============================================================

print()
print("=" * 75)
print("1/5 — INDICVARNA-100K")
print("=" * 75)

print()

if not os.path.exists(INDICVARNA_FILE):

    raise FileNotFoundError(
        f"Could not find:\n{INDICVARNA_FILE}"
    )


indic = pd.read_parquet(
    INDICVARNA_FILE
)


print(
    "Shape:",
    indic.shape
)

print(
    "Columns:",
    indic.columns.tolist()
)


print()

print(
    "Original labels:"
)

print(
    indic["label"].value_counts().sort_index()
)


indic["text"] = (
    indic["text"]
    .apply(clean_text)
)


indic["label"] = (
    indic["label"]
    .astype(int)
)


# IndicVarna already uses:
# 0 = Negative
# 1 = Neutral
# 2 = Positive

indic_clean = indic[
    [
        "text",
        "label",
        "uuid"
    ]
].copy()


indic_clean["language"] = (
    indic_clean["uuid"]
    .astype(str)
    .str.split("-")
    .str[-1]
    .str.lower()
)


indic_clean["source_dataset"] = (
    "IndicVarna-100k"
)


indic_clean["source_id"] = (
    indic_clean["uuid"]
)


indic_clean = indic_clean[
    [
        "text",
        "label",
        "language",
        "source_dataset",
        "source_id"
    ]
]


print()

print(
    "Clean IndicVarna rows:",
    len(indic_clean)
)


# ============================================================
# DATASET 2 — TAMILMIXSENTIMENT
# ============================================================

print()
print("=" * 75)
print("2/5 — TAMILMIXSENTIMENT")
print("=" * 75)


tamil_files = [
    TAMIL_TRAIN,
    TAMIL_VAL,
    TAMIL_TEST
]


tamil_parts = []


for file in tamil_files:

    if os.path.exists(file):

        print()
        print(
            "Loading:",
            os.path.basename(file)
        )

        temp = pd.read_csv(
            file
        )

        print(
            "Shape:",
            temp.shape
        )

        print(
            "Columns:",
            temp.columns.tolist()
        )

        tamil_parts.append(
            temp
        )


if not tamil_parts:

    raise FileNotFoundError(
        "No TamilMixSentiment CSV files found."
    )


tamil = pd.concat(
    tamil_parts,
    ignore_index=True
)


print()

print(
    "Combined Tamil shape:",
    tamil.shape
)


print()

print(
    "Tamil label column candidates:"
)

print(
    tamil.columns.tolist()
)


tamil_text_col = find_text_column(
    tamil
)

tamil_label_col = find_label_column(
    tamil
)


print()

print(
    "Detected text column:",
    tamil_text_col
)

print(
    "Detected label column:",
    tamil_label_col
)


if tamil_text_col is None:

    raise ValueError(
        "Could not find Tamil text column."
    )


if tamil_label_col is None:

    raise ValueError(
        "Could not find Tamil label column."
    )


print()

print(
    "Original Tamil labels:"
)

print(
    tamil[tamil_label_col]
    .value_counts(
        dropna=False
    )
)


# ------------------------------------------------------------
# Tamil label mapping
# ------------------------------------------------------------

def map_tamil_label(value):

    label = normalize_string_label(
        value
    )

    if label is None:
        return None

    # Positive
    if label in [
        "positive",
        "pos",
        "2"
    ]:
        return 2

    # Negative
    if label in [
        "negative",
        "neg",
        "0"
    ]:
        return 0

    # Neutral
    if label in [
        "neutral",
        "neu",
        "1"
    ]:
        return 1

    # Do NOT incorrectly convert these
    # into neutral
    if label in [
        "mixed_feelings",
        "mixed",
        "unknown_state",
        "unknown",
        "not_tamil",
        "not_tamil_language"
    ]:
        return None

    return None


tamil_clean = pd.DataFrame()

tamil_clean["text"] = (
    tamil[tamil_text_col]
    .apply(clean_text)
)


tamil_clean["label"] = (
    tamil[tamil_label_col]
    .apply(map_tamil_label)
)


tamil_clean["language"] = "ta"

tamil_clean["source_dataset"] = (
    "TamilMixSentiment"
)


tamil_clean["source_id"] = (
    np.arange(len(tamil_clean))
    .astype(str)
)


tamil_clean = tamil_clean[
    tamil_clean["label"].notna()
].copy()


tamil_clean["label"] = (
    tamil_clean["label"]
    .astype(int)
)


print()

print(
    "Usable Tamil rows:",
    len(tamil_clean)
)


print()

print(
    "Tamil normalized labels:"
)

print(
    tamil_clean["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# DATASET 3 — SENTNOB
# ============================================================

print()
print("=" * 75)
print("3/5 — SENTNOB")
print("=" * 75)


if not os.path.exists(
    SENTNOB_TRAIN
):

    raise FileNotFoundError(
        SENTNOB_TRAIN
    )


sentnob = pd.read_csv(
    SENTNOB_TRAIN
)


print()

print(
    "Shape:",
    sentnob.shape
)

print(
    "Columns:",
    sentnob.columns.tolist()
)


sent_text_col = find_text_column(
    sentnob
)

sent_label_col = find_label_column(
    sentnob
)


print()

print(
    "Detected text column:",
    sent_text_col
)

print(
    "Detected label column:",
    sent_label_col
)


print()

print(
    "Original SentNoB labels:"
)

print(
    sentnob[sent_label_col]
    .value_counts()
    .sort_index()
)


# SentNoB:
#
# 0 = Neutral
# 1 = Positive
# 2 = Negative
#
# Convert:
#
# 0 -> 1
# 1 -> 2
# 2 -> 0

sentnob_clean = pd.DataFrame()


sentnob_clean["text"] = (
    sentnob[sent_text_col]
    .apply(clean_text)
)


def map_sentnob(value):

    try:

        value = int(value)

    except:

        return None


    mapping = {

        0: 1,

        1: 2,

        2: 0

    }


    return mapping.get(
        value
    )


sentnob_clean["label"] = (
    sentnob[sent_label_col]
    .apply(map_sentnob)
)


sentnob_clean["language"] = "bn"

sentnob_clean["source_dataset"] = (
    "SentNoB"
)


sentnob_clean["source_id"] = (
    np.arange(
        len(sentnob_clean)
    ).astype(str)
)


sentnob_clean = sentnob_clean[
    sentnob_clean["label"].notna()
].copy()


sentnob_clean["label"] = (
    sentnob_clean["label"]
    .astype(int)
)


print()

print(
    "Usable SentNoB rows:",
    len(sentnob_clean)
)


print()

print(
    "Normalized SentNoB labels:"
)

print(
    sentnob_clean["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# DATASET 4 — INDISENTIMENT140
# ============================================================

print()
print("=" * 75)
print("4/5 — INDISENTIMENT140")
print("=" * 75)


if not os.path.exists(
    INDISENTIMENT_FILE
):

    raise FileNotFoundError(
        INDISENTIMENT_FILE
    )


indi140 = pd.read_csv(
    INDISENTIMENT_FILE
)


print()

print(
    "Shape:",
    indi140.shape
)

print(
    "Columns:",
    indi140.columns.tolist()
)


indi140_text_col = find_text_column(
    indi140
)

indi140_label_col = find_label_column(
    indi140
)


print()

print(
    "Detected text column:",
    indi140_text_col
)

print(
    "Detected label column:",
    indi140_label_col
)


if indi140_text_col is None:

    raise ValueError(
        "Could not find IndiSentiment140 text column."
    )


if indi140_label_col is None:

    raise ValueError(
        "Could not find IndiSentiment140 label column."
    )


print()

print(
    "Original IndiSentiment140 labels:"
)

print(
    indi140[indi140_label_col]
    .value_counts(
        dropna=False
    )
)


# ------------------------------------------------------------
# Language detection
# ------------------------------------------------------------

print()

print(
    "Checking whether language column exists..."
)


possible_language_columns = [

    "language",

    "Language",

    "lang",

    "Lang"

]


indi140_language_col = None


for col in possible_language_columns:

    if col in indi140.columns:

        indi140_language_col = col

        break


if indi140_language_col:

    print(
        "Language column found:",
        indi140_language_col
    )

    indi140_languages = (
        indi140[indi140_language_col]
        .astype(str)
        .str.lower()
    )

else:

    print(
        "No language column found."
    )

    print(
        "Using 'unknown' for language."
    )

    indi140_languages = pd.Series(
        ["unknown"] * len(indi140)
    )


# ------------------------------------------------------------
# Label mapping
# ------------------------------------------------------------

def map_indi140(value):

    if pd.isna(value):
        return None

    value_str = str(value).strip().lower()


    # Standard Sentiment140
    if value_str in [
        "0",
        "negative",
        "neg"
    ]:
        return 0


    if value_str in [
        "4",
        "positive",
        "pos"
    ]:
        return 2


    # If a neutral label exists
    if value_str in [
        "2",
        "neutral",
        "neu"
    ]:
        return 1


    return None


indi140_clean = pd.DataFrame()


indi140_clean["text"] = (
    indi140[indi140_text_col]
    .apply(clean_text)
)


indi140_clean["label"] = (
    indi140[indi140_label_col]
    .apply(map_indi140)
)


indi140_clean["language"] = (
    indi140_languages.values
)


indi140_clean["source_dataset"] = (
    "IndiSentiment140"
)


indi140_clean["source_id"] = (
    np.arange(
        len(indi140_clean)
    ).astype(str)
)


indi140_clean = indi140_clean[
    indi140_clean["label"].notna()
].copy()


indi140_clean["label"] = (
    indi140_clean["label"]
    .astype(int)
)


print()

print(
    "Usable IndiSentiment140 rows:",
    len(indi140_clean)
)


print()

print(
    "Normalized IndiSentiment140 labels:"
)

print(
    indi140_clean["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# DATASET 5 — MALAYALAM MIX SENTIMENT
# ============================================================

print()
print("=" * 75)
print("5/5 — MALAYALAMMIXSENTIMENT")
print("=" * 75)


if not os.path.exists(
    MALAYALAM_FILE
):

    raise FileNotFoundError(
        MALAYALAM_FILE
    )


print()

print(
    "Loading Malayalam TSV..."
)


malayalam = pd.read_csv(
    MALAYALAM_FILE,
    sep="\t",
    encoding="utf-8",
    engine="python"
)


print()

print(
    "Shape:",
    malayalam.shape
)

print(
    "Columns:",
    malayalam.columns.tolist()
)


mal_text_col = find_text_column(
    malayalam
)

mal_label_col = find_label_column(
    malayalam
)


print()

print(
    "Detected text column:",
    mal_text_col
)

print(
    "Detected label column:",
    mal_label_col
)


if mal_text_col is None:

    raise ValueError(
        "Could not find Malayalam text column."
    )


if mal_label_col is None:

    raise ValueError(
        "Could not find Malayalam label column."
    )


print()

print(
    "Original Malayalam labels:"
)

print(
    malayalam[mal_label_col]
    .value_counts(
        dropna=False
    )
)


# ------------------------------------------------------------
# Malayalam label mapping
# ------------------------------------------------------------

def map_malayalam(value):

    label = normalize_string_label(
        value
    )

    if label is None:
        return None


    if label in [
        "positive",
        "pos",
        "2"
    ]:
        return 2


    if label in [
        "negative",
        "neg",
        "0"
    ]:
        return 0


    if label in [
        "neutral",
        "neu",
        "1"
    ]:
        return 1


    # Do not force ambiguous labels
    if label in [
        "mixed",
        "mixed_feelings",
        "unknown",
        "unknown_state",
        "not_malayalam",
        "not_malayalam_language"
    ]:
        return None


    return None


malayalam_clean = pd.DataFrame()


malayalam_clean["text"] = (
    malayalam[mal_text_col]
    .apply(clean_text)
)


malayalam_clean["label"] = (
    malayalam[mal_label_col]
    .apply(map_malayalam)
)


malayalam_clean["language"] = "ml"

malayalam_clean["source_dataset"] = (
    "MalayalamMixSentiment"
)


malayalam_clean["source_id"] = (
    np.arange(
        len(malayalam_clean)
    ).astype(str)
)


malayalam_clean = malayalam_clean[
    malayalam_clean["label"].notna()
].copy()


malayalam_clean["label"] = (
    malayalam_clean["label"]
    .astype(int)
)


print()

print(
    "Usable Malayalam rows:",
    len(malayalam_clean)
)


print()

print(
    "Normalized Malayalam labels:"
)

print(
    malayalam_clean["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# COMBINE ALL DATASETS
# ============================================================

print()
print("=" * 75)
print("COMBINING DATASETS")
print("=" * 75)


all_datasets = [

    indic_clean,

    tamil_clean,

    sentnob_clean,

    indi140_clean,

    malayalam_clean

]


combined = pd.concat(

    all_datasets,

    ignore_index=True

)


print()

print(
    "Rows before cleaning:",
    len(combined)
)


# ============================================================
# REMOVE EMPTY TEXT
# ============================================================

combined = combined[
    combined["text"].str.len() > 0
].copy()


# ============================================================
# REMOVE DUPLICATE TEXT
# ============================================================

before_duplicates = len(
    combined
)


combined = combined.drop_duplicates(
    subset=["text"]
).reset_index(
    drop=True
)


print()

print(
    "Duplicate rows removed:",
    before_duplicates -
    len(combined)
)


# ============================================================
# FINAL LABEL DISTRIBUTION
# ============================================================

print()

print("=" * 75)
print("COMBINED LABEL DISTRIBUTION")
print("=" * 75)


label_distribution = (
    combined["label"]
    .value_counts()
    .sort_index()
)


print(
    label_distribution
)


# ============================================================
# LANGUAGE DISTRIBUTION
# ============================================================

print()

print("=" * 75)
print("COMBINED LANGUAGE DISTRIBUTION")
print("=" * 75)


print(
    combined["language"]
    .value_counts()
)


# ============================================================
# SOURCE DISTRIBUTION
# ============================================================

print()

print("=" * 75)
print("SOURCE DATASET DISTRIBUTION")
print("=" * 75)


print(
    combined["source_dataset"]
    .value_counts()
)


# ============================================================
# BALANCE DATASET
# ============================================================

print()
print("=" * 75)
print("BALANCING CLASSES")
print("=" * 75)


class_counts = (
    combined["label"]
    .value_counts()
)


minimum_class_size = (
    class_counts.min()
)


print()

print(
    "Smallest class:",
    minimum_class_size
)


print()

print(
    "Each class will be limited to:",
    minimum_class_size
)


balanced_parts = []


for label in [0, 1, 2]:

    class_data = combined[
        combined["label"] == label
    ].copy()


    class_data = class_data.sample(

        n=minimum_class_size,

        random_state=RANDOM_SEED + label

    )


    balanced_parts.append(
        class_data
    )


balanced = pd.concat(
    balanced_parts,
    ignore_index=True
)


balanced = balanced.sample(

    frac=1,

    random_state=RANDOM_SEED

).reset_index(
    drop=True
)


print()

print(
    "Balanced dataset size:",
    len(balanced)
)


print()

print(
    "Balanced distribution:"
)

print(
    balanced["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# SAVE COMPLETE BALANCED DATASET
# ============================================================

balanced_file = os.path.join(

    BASE_DIR,

    "combined_balanced_sentiment.csv"

)


balanced.to_csv(

    balanced_file,

    index=False,

    encoding="utf-8-sig"

)


print()

print(
    "Saved:"
)

print(
    balanced_file
)


# ============================================================
# CREATE 85/15 TRAIN TEST SPLIT
# ============================================================

print()
print("=" * 75)
print("CREATING 85% TRAIN / 15% TEST SPLIT")
print("=" * 75)


train_df, test_df = train_test_split(

    balanced,

    test_size=TEST_SIZE,

    random_state=RANDOM_SEED,

    stratify=balanced["label"]

)


train_df = train_df.reset_index(
    drop=True
)

test_df = test_df.reset_index(
    drop=True
)


print()

print(
    "Training samples:",
    len(train_df)
)


print(
    "Testing samples:",
    len(test_df)
)


print()

print(
    "Training label distribution:"
)

print(
    train_df["label"]
    .value_counts()
    .sort_index()
)


print()

print(
    "Testing label distribution:"
)

print(
    test_df["label"]
    .value_counts()
    .sort_index()
)


# ============================================================
# SAVE TRAIN / TEST
# ============================================================

train_file = os.path.join(

    BASE_DIR,

    "combined_train_85.csv"

)


test_file = os.path.join(

    BASE_DIR,

    "combined_test_15.csv"

)


train_df.to_csv(

    train_file,

    index=False,

    encoding="utf-8-sig"

)


test_df.to_csv(

    test_file,

    index=False,

    encoding="utf-8-sig"

)


# ============================================================
# SAVE SUMMARY
# ============================================================

summary_file = os.path.join(

    BASE_DIR,

    "combined_dataset_summary.txt"

)


with open(

    summary_file,

    "w",

    encoding="utf-8"

) as f:


    f.write(
        "COMBINED INDIAN SENTIMENT DATASET\n"
    )

    f.write(
        "=" * 60 + "\n\n"
    )


    f.write(
        f"Total balanced samples: {len(balanced)}\n"
    )


    f.write(
        f"Training samples: {len(train_df)}\n"
    )


    f.write(
        f"Testing samples: {len(test_df)}\n\n"
    )


    f.write(
        "LABELS\n"
    )

    f.write(
        "0 = Negative\n"
    )

    f.write(
        "1 = Neutral\n"
    )

    f.write(
        "2 = Positive\n\n"
    )


    f.write(
        "LABEL DISTRIBUTION\n"
    )

    f.write(
        str(
            balanced["label"]
            .value_counts()
            .sort_index()
        )
    )

    f.write("\n\n")


    f.write(
        "LANGUAGE DISTRIBUTION\n"
    )

    f.write(
        str(
            balanced["language"]
            .value_counts()
        )
    )

    f.write("\n\n")


    f.write(
        "SOURCE DISTRIBUTION\n"
    )

    f.write(
        str(
            balanced["source_dataset"]
            .value_counts()
        )
    )


# ============================================================
# FINAL OUTPUT
# ============================================================

print()
print("=" * 75)
print("DATA PREPARATION COMPLETE")
print("=" * 75)

print()

print("Files created:")

print(
    "1. combined_balanced_sentiment.csv"
)

print(
    "2. combined_train_85.csv"
)

print(
    "3. combined_test_15.csv"
)

print(
    "4. combined_dataset_summary.txt"
)

print()

print("Label mapping:")

print(
    "0 = Negative"
)

print(
    "1 = Neutral"
)

print(
    "2 = Positive"
)

print()

print("=" * 75)
print("NEXT STEP: TRAIN INDICBERTv2")
print("=" * 75)