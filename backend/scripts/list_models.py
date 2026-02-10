import os
import sys
from pathlib import Path
import asyncio

# Ensure backend modules can be imported
sys.path.append(str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env')

from google import genai

def list_models():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    try:
        print("Listing available models...")
        # Note: In the new SDK, use client.models.list()
        for model in client.models.list():
            print(f"Model: {model.name}")
            print(f"  DisplayName: {model.display_name}")
            print(f"  Supported Actions: {model.supported_actions}")
            print("-" * 20)

    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
