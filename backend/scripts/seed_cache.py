import os
import sys
from pathlib import Path
import asyncio

# Ensure backend modules can be imported
sys.path.append(str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
# Load env before importing modules that might use it
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env')

from managers.ai_generator import ai_generator

async def seed_cache():
    print("Seeding cache for Elara Vance...")
    
    # Read the Life Story
    life_story_path = Path("/Users/andrewnguyen/.gemini/antigravity/brain/a94fbe22-1edd-45f7-ba7f-c27f5ccb8331/life_story.md")
    if not life_story_path.exists():
        print(f"Error: {life_story_path} not found.")
        return

    life_story_content = life_story_path.read_text()
    
    persona = {
        "background": "Solarpunk Architect, former Systems Architect at OmniCorp.",
        "goals": ["Build a localized AI mesh network", "Promote sustainable technology", "Rewild technology"],
        "tone": "Optimistic, contemplative, precise, tactile."
    }
    
    # Create the cache
    cache_name = ai_generator._get_or_create_cache("Elara Vance", life_story_content, persona)
    
    if cache_name:
        print(f"Successfully created cache: {cache_name}")
    else:
        print("Failed to create cache.")

    # List active caches to verify
    print("\nVerifying active caches...")
    if ai_generator.client:
        caches = ai_generator.client.caches.list()
        count = 0
        for cache in caches:
            count += 1
            print(f"Cache #{count}:")
            print(f"  Name: {cache.name}")
            print(f"  Expires: {cache.expire_time}")
            print("-" * 20)
        if count == 0:
            print("No caches found on verification step.")

if __name__ == "__main__":
    asyncio.run(seed_cache())
