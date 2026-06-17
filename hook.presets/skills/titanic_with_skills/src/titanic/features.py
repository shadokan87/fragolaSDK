"""Feature engineering for Titanic dataset."""
import pandas as pd
import numpy as np


def engineer_features(X: pd.DataFrame) -> pd.DataFrame:
    """Engineer features from raw data."""
    X = X.copy()
    
    # Age: fill with median by Pclass
    X["Age"] = X.groupby("Pclass")["Age"].transform(
        lambda x: x.fillna(x.median())
    )
    
    # Embarked: fill with mode
    X["Embarked"] = X["Embarked"].fillna(X["Embarked"].mode()[0])
    
    # Fare: fill with median by Pclass
    X["Fare"] = X.groupby("Pclass")["Fare"].transform(
        lambda x: x.fillna(x.median())
    )
    
    # Title from Name
    X["Title"] = X["Name"].str.extract(" ([A-Za-z]+)\.", expand=False)
    X["Title"] = X["Title"].replace(
        ["Lady", "Countess", "Capt", "Col", "Don", "Dr", "Major", "Rev", "Sir", "Jonkheer"],
        "Rare"
    )
    X["Title"] = X["Title"].replace("Mlle", "Miss")
    X["Title"] = X["Title"].replace("Ms", "Miss")
    X["Title"] = X["Title"].replace("Mme", "Mrs")
    
    # Family size
    X["FamilySize"] = X["SibSp"] + X["Parch"] + 1
    X["IsAlone"] = (X["FamilySize"] == 1).astype(int)
    
    return X
