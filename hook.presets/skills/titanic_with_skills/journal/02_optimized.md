# Experiment 02: Tuned Logistic Heuristics

## Design Note

### Problem Statement
Optimize prediction rules by leveraging known Titanic survival patterns:
- "Women and children first" (strongest signal)
- Class-based survival differences
- Age effects (very young and elderly different)
- Wealth proxy (fare amount)
- Cabin information (first-class indicator)

### Approach
1. **Primary Rule:** Sex-based decision (women: 74%, children: 57%, men: 19%)
2. **Class Adjustment:** Pclass bonus/penalty (±25%, ±5%, -10%)
3. **Age Refinement:** Very young (+15%), elderly (-10%)
4. **Fare Normalization:** Continuous adjustment (0-15% bonus)
5. **Family Effects:** Large family penalty (-15%), solo adjustment (-5%)
6. **Status Indicators:** Master, Cabin, Cherbourg embarkation

### Results
- Training Accuracy: 77.22%
- Test predictions: 207/418 survivors (49.5% survival rate)
- Better class distribution representation

## Status
✅ Completed - Best baseline model

## Observation
The tuned model shows strong discrimination between classes while maintaining sensible survival rate distribution aligned with historical proportions.
