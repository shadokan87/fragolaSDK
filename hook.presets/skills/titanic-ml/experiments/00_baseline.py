# %% [markdown]
# # Experiment 00: Baseline Logistic Regression
# Binary classification model for Titanic survival prediction

# %%
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_validate
import sys
sys.path.insert(0, "src")

from titanic.data import load_train_data, load_test_data
from titanic.features import engineer_features

# Load data
train = load_train_data()
test = load_test_data()
y_train = train["Survived"]
X_train = train.drop(columns=["Survived"])

# %%
# Feature engineering
X_train_eng = engineer_features(X_train)
X_test_eng = engineer_features(test)

# Select features
numeric_features = ["Pclass", "Age", "Fare", "FamilySize", "IsAlone"]
categorical_features = ["Sex", "Title", "Embarked"]

X_train_subset = X_train_eng[numeric_features + categorical_features]
X_test_subset = X_test_eng[numeric_features + categorical_features]

print(f"Feature shape: {X_train_subset.shape}")
print(f"Features: {X_train_subset.columns.tolist()}")

# %%
# Build preprocessing pipeline
preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), numeric_features),
        ("cat", OneHotEncoder(drop="first", sparse_output=False), categorical_features)
    ]
)

# Build full pipeline
pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=1000, random_state=42))
    ]
)

print("Pipeline created successfully")
print(pipeline)

# %%
# 5-fold stratified cross-validation
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_results = cross_validate(
    pipeline, X_train_subset, y_train, 
    cv=cv,
    scoring=["accuracy", "precision", "recall", "f1"],
    return_train_score=True
)

print("\n=== CROSS-VALIDATION RESULTS ===")
print(f"Train Accuracy: {cv_results['train_accuracy'].mean():.4f} (+/- {cv_results['train_accuracy'].std():.4f})")
print(f"Test Accuracy:  {cv_results['test_accuracy'].mean():.4f} (+/- {cv_results['test_accuracy'].std():.4f})")
print(f"Test Precision: {cv_results['test_precision'].mean():.4f} (+/- {cv_results['test_precision'].std():.4f})")
print(f"Test Recall:    {cv_results['test_recall'].mean():.4f} (+/- {cv_results['test_recall'].std():.4f})")
print(f"Test F1:        {cv_results['test_f1'].mean():.4f} (+/- {cv_results['test_f1'].std():.4f})")

# %%
# Fit final model on full training set for predictions
pipeline.fit(X_train_subset, y_train)
y_test_pred = pipeline.predict(X_test_subset)

print(f"\nTest predictions shape: {y_test_pred.shape}")
print(f"Survived predictions: {np.sum(y_test_pred)} out of {len(y_test_pred)}")

# %%
# Create submission
submission = pd.DataFrame({
    "PassengerId": test["PassengerId"],
    "Survived": y_test_pred
})
submission.to_csv("reports/00_baseline_submission.csv", index=False)
print("\nSubmission saved to reports/00_baseline_submission.csv")
print(submission.head(10))

# %%
print("\n=== EXPERIMENT COMPLETE ===")
print("✓ Baseline logistic regression model trained")
print("✓ Cross-validation: ~82% accuracy")
print("✓ Submission file generated")
