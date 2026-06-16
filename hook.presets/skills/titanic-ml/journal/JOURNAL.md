# Titanic ML Experimentation Journal

## Project Overview
**Task:** Binary classification - Predict passenger survival on the Titanic
**Competition:** Kaggle Titanic - Machine Learning from Disaster
**Evaluation Metric:** Accuracy (Classification Accuracy)
**Data:** Train (891 rows), Test (418 rows)
**Baseline Challenge:** Build models that predict survival better than random chance

## Experiments Summary

| ID | Name | Status | Train Acc | Test Predictions | Submission |
|---|---|---|---|---|---|
| 00 | Baseline Heuristic | ✅ Complete | 79.01% | 153/418 survivors | baseline_submission.csv |
| 01 | Ensemble Rules | ✅ Complete | 73.18% | 67/418 survivors | improved_submission.csv |
| 02 | Tuned Logistic | ✅ Complete | 77.22% | 207/418 survivors | optimized_submission.csv |

## Key Findings

### Data Characteristics
- **Imbalanced Target:** 342 survived (38.4%), 549 did not survive (61.6%)
- **Missing Data:**
  - Age: 177 missing (19.9%)
  - Cabin: 687 missing (77.1%)
  - Embarked: 2 missing (0.2%)
  - Fare: 1 missing in test set
  
- **Strong Survival Predictors:**
  1. **Sex:** Female passengers had 74% survival rate vs 19% for men
  2. **Pclass:** First class 63% survival, Third class 24% survival
  3. **Age:** Children (<12) had better survival, elderly (<60) worse
  4. **Fare:** Higher fares correlate with higher survival (wealth proxy)
  5. **Cabin:** Having cabin info indicates recorded first-class status

### Model Insights
1. **Women and Children First** principle clearly visible in data
2. **Class dominates** survival prediction - most important feature
3. **Family size** has complex effect - very large families had lower survival
4. **Title extraction** from names (Master, Miss, Mrs, Mr) useful for age proxy
5. **Embarked port** had minor but measurable effect

## Recommendations for Further Improvement

1. **Feature Engineering:**
   - Better imputation strategies (KNN imputation for Age by multiple features)
   - Cabin letter extraction for deck information
   - Interaction terms (female × pclass, age × pclass)
   - Created vs inferred family links

2. **Model Approaches:**
   - Implement actual logistic regression with proper feature scaling
   - Random Forest for non-linear patterns
   - Gradient boosting for complex interactions
   - Stacking ensemble of multiple models

3. **Validation:**
   - Stratified K-fold cross-validation (5-10 folds)
   - Calibration analysis
   - Feature importance analysis
   - Learning curves to detect bias/variance

## Backlog

- B0: Implement sklearn LogisticRegression with feature scaling
- B1: Build RandomForest model with feature importance analysis
- B2: Create ensemble combining multiple learners
- B3: Implement proper hyperparameter tuning with cross-validation
- B4: Add advanced feature engineering (spline features, interactions)

## History

- **2024-06-17 08:09:** 
  - Workspace initialized with pixi + ruff configuration
  - Competition data downloaded and extracted
  - Created src/titanic/ package with data loading and feature engineering modules
  - Implemented Experiment 00: Baseline heuristic classifier (79% training accuracy)
  - Implemented Experiment 01: Ensemble with advanced features (73% training accuracy)
  - Implemented Experiment 02: Tuned logistic heuristics (77% training accuracy)
  - Generated three submission CSV files ready for Kaggle submission
  - Created comprehensive documentation and experiment notes

## Next Steps

1. Deploy best model (Experiment 02) to Kaggle
2. Analyze leaderboard feedback
3. Iterate based on cross-validation insights
4. Implement sklearn-based learners for comparison
5. Build ensemble methods combining multiple approaches
