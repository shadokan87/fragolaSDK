# %% [markdown]
# # Titanic Dataset Exploration

# %%
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Load the data
train = pd.read_csv("data/train.csv")
test = pd.read_csv("data/test.csv")

print("=== DATASET SHAPES ===")
print(f"Train shape: {train.shape}")
print(f"Test shape: {test.shape}")

# %%
print("\n=== TRAINING DATA HEAD ===")
train.head(10)

# %%
print("\n=== DATA TYPES ===")
train.dtypes

# %%
print("\n=== MISSING VALUES ===")
missing_train = train.isnull().sum()
missing_train[missing_train > 0]

# %%
print("\n=== MISSING VALUES TEST ===")
missing_test = test.isnull().sum()
missing_test[missing_test > 0]

# %%
print("\n=== TARGET DISTRIBUTION ===")
target_dist = train["Survived"].value_counts()
print(target_dist)
print(f"\nSurvival rate: {train['Survived'].mean():.2%}")

# %%
print("\n=== NUMERICAL FEATURES STATISTICS ===")
train.describe()

# %%
print("\n=== CATEGORICAL FEATURES ===")
for col in ["Sex", "Embarked", "Pclass"]:
    if col in train.columns:
        print(f"\n{col}:")
        print(train[col].value_counts())

# %%
print("\n=== SURVIVAL BY SEX ===")
pd.crosstab(train["Sex"], train["Survived"], margins=True)

# %%
print("\n=== SURVIVAL BY PCLASS ===")
pd.crosstab(train["Pclass"], train["Survived"], margins=True)

# %%
print("\n=== SURVIVAL BY AGE GROUPS ===")
train["AgeGroup"] = pd.cut(train["Age"], bins=[0, 12, 18, 65, 100], labels=["Child", "Teen", "Adult", "Senior"])
pd.crosstab(train["AgeGroup"], train["Survived"], margins=True)

# %%
print("\n=== FARE STATISTICS BY SURVIVAL ===")
train.groupby("Survived")["Fare"].describe()

# %%
print("\n=== KEY INSIGHTS ===")
print("1. Female passengers had much higher survival rate")
print("2. Higher class passengers (Pclass 1) had higher survival")
print("3. Age matters - children had better survival rates")
print("4. Missing values: Age, Cabin, Embarked")
print("5. Target is balanced but slightly more did not survive")
