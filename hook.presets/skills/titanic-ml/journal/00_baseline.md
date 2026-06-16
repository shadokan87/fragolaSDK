# Experiment 00: Baseline Logistic Regression

## Design Note

### Problem Statement
Predict binary target (Survived: 0/1) for 418 test passengers using 891 training examples.

### Approach
- **Model Family:** Logistic Regression (linear baseline)
- **Feature Set:** 
  - Numerical: Pclass, Age, Fare, FamilySize, IsAlone
  - Categorical (one-hot): Sex, Title, Embarked
- **Preprocessing:**
  - Age: median imputation by Pclass
  - Embarked: mode imputation
  - Fare: median imputation by Pclass
  - Title: extracted from Name, consolidated (Mr, Mrs, Miss, Master, Rare)
  - Family features: SibSp + Parch = FamilySize, IsAlone binary
- **Cross-validation:** 5-fold stratified (maintain target distribution)
- **Evaluation Metric:** Accuracy (competition metric)

### Justification
Logistic regression is interpretable, fast, and serves as a solid baseline. The feature selection targets known survival predictors from EDA:
- Sex: Women had 73% survival vs 19% for men
- Pclass: Cabin class strongly predicts survival
- Age: Children had better survival rates
- Fare: Proxy for wealth/class

### Success Criteria
- Train accuracy > 80%
- CV accuracy > 78%
- No data leakage (features only use pre-sinking information)

## Status
✅ Approved - Ready for implementation
