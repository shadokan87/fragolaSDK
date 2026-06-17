"""Optimized model with better rule tuning."""
import csv
from pathlib import Path

# Load data
train_data = []
with open("data/train.csv", "r") as f:
    train_data = list(csv.DictReader(f))

test_data = []
test_ids = []
with open("data/test.csv", "r") as f:
    reader = csv.DictReader(f)
    test_data = list(reader)
    test_ids = [row["PassengerId"] for row in test_data]

print(f"Training samples: {len(train_data)}")
print(f"Test samples: {len(test_data)}")

def get_features(row):
    """Extract all relevant features."""
    sex = 1.0 if row["Sex"] == "female" else 0.0
    pclass = float(row["Pclass"])
    
    try:
        age = float(row["Age"])
    except (ValueError, KeyError):
        age = 29.7
    
    try:
        fare = float(row["Fare"])
    except (ValueError, KeyError):
        fare = 32.2
    
    sibsp = int(row["SibSp"])
    parch = int(row["Parch"])
    family_size = sibsp + parch + 1
    
    name = row.get("Name", "")
    is_master = 1.0 if "Master" in name else 0.0
    
    embarked = row.get("Embarked", "S")
    is_cherbourg = 1.0 if embarked == "C" else 0.0
    
    cabin = row.get("Cabin", "")
    has_cabin = 1.0 if cabin else 0.0
    
    return {
        "sex": sex,
        "pclass": pclass,
        "age": age,
        "fare": fare,
        "family_size": float(family_size),
        "is_master": is_master,
        "is_cherbourg": is_cherbourg,
        "has_cabin": has_cabin,
    }

X_train = [get_features(row) for row in train_data]
y_train = [int(row["Survived"]) for row in train_data]
X_test = [get_features(row) for row in test_data]

print(f"Features extracted. Sample feature count: {len(X_train[0])}")

# Optimized prediction function
def predict_optimized(f):
    """Optimized ensemble with tuned thresholds."""
    
    # Women and children first policy (strongest signal)
    # Women: 74% survived
    if f["sex"] == 1.0:
        base = 0.74
    # Children (age < 12): ~57% survived
    elif f["age"] < 12:
        base = 0.57
    # Men: ~19% survived
    else:
        base = 0.19
    
    # Pclass adjustment (strong effect)
    # Class 1: +30%, Class 2: +10%, Class 3: -10%
    class_bonus = {
        1.0: 0.25,
        2.0: 0.05,
        3.0: -0.10,
    }
    base += class_bonus.get(f["pclass"], 0.0)
    
    # Age adjustment
    if f["age"] < 5:  # Very young
        base += 0.15
    elif f["age"] > 60:  # Elderly
        base -= 0.10
    
    # Fare adjustment (continuous, normalized)
    # Higher fare = higher survival (proxy for wealth)
    fare_norm = min(f["fare"] / 80, 1.0)
    base += fare_norm * 0.15
    
    # Family size effect
    if f["family_size"] > 5:  # Large families
        base -= 0.15
    elif f["family_size"] == 1:  # Alone
        base -= 0.05
    
    # Master status (children with titles)
    if f["is_master"] == 1.0:
        base += 0.15
    
    # Cabin presence (indicates recorded first class)
    if f["has_cabin"] == 1.0:
        base += 0.10
    
    # Cherbourg embarkation
    if f["is_cherbourg"] == 1.0:
        base += 0.05
    
    # Clip to [0, 1]
    base = max(0.0, min(1.0, base))
    
    return 1 if base > 0.5 else 0

# Make predictions
y_train_pred = [predict_optimized(f) for f in X_train]
y_test_pred = [predict_optimized(f) for f in X_test]

# Calculate training accuracy
acc = sum(y == yp for y, yp in zip(y_train, y_train_pred)) / len(y_train)
print(f"\n=== RESULTS ===")
print(f"Training Accuracy: {acc:.4f}")
print(f"Survived in training: {sum(y_train)} / {len(y_train)}")
print(f"Predicted survivors in test: {sum(y_test_pred)} / {len(y_test_pred)}")

# Save submission
output = Path("reports/02_optimized_submission.csv")
output.parent.mkdir(parents=True, exist_ok=True)

with open(output, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["PassengerId", "Survived"])
    for pid, pred in zip(test_ids, y_test_pred):
        w.writerow([pid, pred])

print(f"\n✓ Submission saved: {output}")
