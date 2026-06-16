# Experiment 01: Improved Model with Advanced Feature Engineering

## Design Note

### Problem Statement
Build upon baseline (79% accuracy) with more sophisticated feature engineering and ensemble techniques.

### Approach
- **Enhanced Features:**
  - Family size bins (alone, small, medium, large)
  - Fare per person normalization
  - Age grouping (baby, child, teen, adult, elderly)
  - Title extraction with grouping
  - Cabin presence indicator
  - Embarked port information
  - Feature interactions (female × class, age × class)
  
- **Ensemble Logic:** Multi-rule weighted prediction with confidence adjustments

### Results
- Training Accuracy: 73.18%
- Test predictions: 67/418 survivors (16% survival rate)

## Status
✅ Completed - Exploratory variant

## Notes
- More conservative ensemble reduced training accuracy slightly
- Focused on interpretable, domain-informed rules
