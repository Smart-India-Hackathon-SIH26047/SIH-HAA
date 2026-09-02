from datasets import load_dataset
import pandas as pd

print("=" * 60)
print("DOWNLOADING INDISENTIMENT140 SAMPLE")
print("=" * 60)

TARGET = 20000

print("\nStarting dataset stream...")

dataset = load_dataset(
    "saurabh1003/IndiSentiment140",
    split="train",
    streaming=True
)

rows = []

for i, row in enumerate(dataset):

    rows.append(row)

    if len(rows) >= TARGET:
        break

    if (i + 1) % 1000 == 0:
        print(
            f"Collected {i + 1} / {TARGET}"
        )

print("\nConverting to DataFrame...")

df = pd.DataFrame(rows)

print("\nDataset shape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 rows:")
print(df.head())

print("\nSaving file...")

df.to_csv(
    "indisentiment140_sample.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\n" + "=" * 60)
print("DOWNLOAD COMPLETE")
print("=" * 60)

print(
    f"Saved {len(df)} rows"
)

print(
    "File: indisentiment140_sample.csv"
)