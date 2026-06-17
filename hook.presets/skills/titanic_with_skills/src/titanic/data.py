"""Data loading and basic processing for Titanic dataset."""
import pandas as pd
from pathlib import Path


def load_train_data(data_dir: str = "data") -> pd.DataFrame:
    """Load training data."""
    return pd.read_csv(Path(data_dir) / "train.csv")


def load_test_data(data_dir: str = "data") -> pd.DataFrame:
    """Load test data."""
    return pd.read_csv(Path(data_dir) / "test.csv")
