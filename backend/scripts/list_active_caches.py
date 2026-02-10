import os
import sys
from pathlib import Path

# Add backend directory to path to import config if needed, or just use dotenv directly
sys.path.append(str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from google import genai
import datetime

# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def list_caches():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in environment.")
        return

    client = genai.Client(api_key=api_key)

    try:
        print("Fetching active caches...")
        # Note: The exact method to list caches might depend on the SDK version.
        # Based on google-genai documentation patterns.
        # If client.caches.list() is not available, we might need to check specific resource methods.
        # Assuming standard list method exists.
        
        caches = client.caches.list()
        
        count = 0
        for cache in caches:
            count += 1
            # Handle potential different object structures (pydantic model vs dict)
            name = getattr(cache, 'name', 'Unknown')
            expire_time = getattr(cache, 'expire_time', 'Unknown')
            
            print(f"Cache #{count}:")
            print(f"  Name: {name}")
            print(f"  Expires: {expire_time}")
            print("-" * 20)
            
        if count == 0:
            print("No active caches found.")
            
    except Exception as e:
        print(f"Error listing caches: {e}")

if __name__ == "__main__":
    list_caches()
