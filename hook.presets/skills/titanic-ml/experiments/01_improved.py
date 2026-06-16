"""Improved model with better feature engineering."""
import csv
import math
from pathlib import Path
from collections import defaultdict

# Load data
train_data = []
with open("data/train.csv", "r") as f:
    reader = csv.DictReader(f)
    train_data = list(reader)

test_data = []
test_ids = []
with open("data/test.csv", "r") as f:
    reader = csv.DictReader(f)
    test_data = list(reader)
    test_ids = [row["PassengerId"] for row in test_data]

print(f"Loaded {len(train_data)} training + {len(test_data)} test samples")

def extract_advanced_features(row):
    """Extract advanced features."""
    features = {}
    
    # Basic features
    features["pclass"] = float(row["Pclass"])
    features["is_female"] = 1.0 if row["Sex"] == "female" else 0.0
    
    # Age with imputation by class/sex
    try:
        features["age"] = float(row["Age"])
    except (ValueError, KeyError):
        features["age"] = 29.7  # median
    
    # Fare with imputation
    try:
        features["fare"] = float(row["Fare"])
    except (ValueError, KeyError):
        features["fare"] = 32.2
    
    # Family features
    sibsp = int(row["SibSp"])
    parch = int(row["Parch"])
    family_size = sibsp + parch + 1
    features["family_size"] = float(family_size)
    features["is_alone"] = 1.0 if family_size == 1 else 0.0
    features["large_family"] = 1.0 if family_size > 4 else 0.0
    
    # Fare per person
    features["fare_per_person"] = features["fare"] / family_size
    
    # Age bins
    if features["age"] < 5:
        features["age_bin"] = 0.0  # baby
    elif features["age"] < 12:
        features["age_bin"] = 1.0  # child
    elif features["age"] < 18:
        features["age_bin"] = 2.0  # teen
    elif features["age"] < 60:
        features["age_bin"] = 3.0  # adult
    else:
        features["age_bin"] = 4.0  # elderly
    
    # Title
    name = row.get("Name", "")
    if "Master" in name:
        features["title_code"] = 0.0
    elif "Miss" in name:
        features["title_code"] = 1.0
    elif "Mrs" in name:
        features["title_code"] = 2.0
    elif "Mr" in name:
        features["title_code"] = 3.0
    else:
        features["title_code"] = 4.0
    
    # Embarked
    embarked = row.get("Embarked", "S")
    features["embarked_C"] = 1.0 if embarked == "C" else 0.0
    features["embarked_Q"] = 1.0 if embarked == "Q" else 0.0
    
    # Cabin level (if available)
    cabin = row.get("Cabin", "")
    if cabin:
        features["has_cabin"] = 1.0
        cabin_letter = cabin[0]
        features["cabin_deck"] = float(ord(cabin_letter) - ord("A")) / 7.0
    else:
        features["has_cabin"] = 0.0
        features["cabin_deck"] = 0.5
    
    # Interactions
    features["female_high_class"] = features["is_female"] * (1 - features["pclass"] / 3)
    features["young_age"] = 1.0 if features["age"] < 18 else 0.0
    
    return features

print("\nExtracting features...")
X_train = [extract_advanced_features(row) for row in train_data]
y_train = [int(row["Survived"]) for row in train_data]
X_test = [extract_advanced_features(row) for row in test_data]

print(f"Feature count: {len(X_train[0])}")

# Ensemble predictor
def predict_with_ensemble(f):
    """Multi-rule ensemble prediction."""
    
    # Rule 1: Female passengers (very strong signal)
    if f["is_female"] == 1.0:
        rule1 = 0.75
    else:
        rule1 = 0.15
    
    # Rule 2: Class-based (Pclass 1 much higher survival)
    rule2 = 0.15 + (1 - f["pclass"] / 3) * 0.25
    
    # Rule 3: Age-based (children have advantage)
    if f["young_age"] == 1.0:
        rule3 = 0.70
    elif f["age"] < 5:
        rule3 = 0.85
    else:
        rule3 = 0.30
    
    # Rule 4: Family size (some family better than alone, but large families worse)
    if f["is_alone"] == 1.0:
        rule4 = 0.25
    elif f["large_family"] == 1.0:
        rule4 = 0.30
    else:
        rule4 = 0.45
    
    # Rule 5: Fare indicator (expensive tickets = higher class/survival)
    rule5 = 0.25 + (f["fare_per_person"] / 100) * 0.4
    rule5 = min(rule5, 0.75)
    
    # Rule 6: Cabin presence (first class had cabins recorded)
    if f["has_cabin"] == 1.0:
        rule6 = 0.50
    else:
        rule6 = 0.30
    
    # Weighted ensemble
    weights = [0.35, 0.20, 0.20, 0.10, 0.10, 0.05]
    rules = [rule1, rule2, rule3, rule4, rule5, rule6]
    
    ensemble_prob = sum(w * r for w, r in zip(weights, rules))
    
    # Confidence adjustment based on feature consistency
    if f["is_female"] == 1.0 and f["pclass"] < 2:
        ensemble_prob += 0.05  # First class women extra boost
    
    if f["age"] < 5 and f["is_alone"] == 0.0:
        ensemble_prob += 0.05  # Young with family
    
    return 1 if ensemble_prob > 0.5 else 0

print("\nMaking predictions...")
y_pred_train = [predict_with_ensemble(f) for f in X_train]
y_pred_test = [predict_with_ensemble(f) for f in X_test]

# Evaluate
correct = sum(1 for i in range(len(y_train)) if y_train[i] == y_pred_train[i])
accuracy = correct / len(y_train)
print(f"\nTraining Accuracy: {accuracy:.4f} ({correct}/{len(y_train)})")
print(f"Test survivors predicted: {sum(y_pred_test)}/{len(y_pred_test)}")

# Save submission
submission_path = Path("reports/01_improved_submission.csv")
submission_path.parent.mkdir(parents=True, exist_ok=True)

with open(submission_path, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["PassengerId", "Survived"])
    for pid, survival in zip(test_ids, y_pred_test):
        writer.writerow([pid, survival])

print(f"\nSubmission saved to {submission_path}")
print("\n✓ Improved model complete")
