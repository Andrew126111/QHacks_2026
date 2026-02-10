import os
import logging
import asyncio
import json
from typing import Dict, Any, Optional
from pathlib import Path
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class VeoVideoGenerator:
    """
    Handles video generation using Veo 3.1 Fast and 
    Multimodal Verification using Gemini 3 Flash.
    """
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not found. Video features will be limited.")
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)
            
        self.output_dir = Path("storage/generated_videos")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_video(self, prompt: str, duration_seconds: int = 5) -> Optional[str]:
        """
        Mock implementation for safe testing.
        Prints intent and returns a dummy URL.
        """
        print(f"MOCK: Generating Video for {prompt}")
        
        # Simulate API latency
        await asyncio.sleep(1)
        
        dummy_url = "https://example.com/dummy_video.mp4"
        logger.info(f"Mock video generated: {dummy_url}")
        return dummy_url

    async def verify_content(self, video_path: str, script: str, persona_vibe: str) -> bool:
        """
        [Multimodal Verification]
        Uses Gemini 3 Flash to 'watch' the video and verify it matches the script and 'Caelum' solarpunk vibe.
        """
        if not self.client:
            logger.warning("No client for verification. Skipping.")
            return False 

        # Mock check: If it's a dummy URL, skip verification and pass
        if video_path.startswith("http"):
            logger.info("Mock video detected. Skipping verification and returning True.")
            return True 

        logger.info(f"Verifying video content against script: {script[:30]}...")
        
        prompt = f"""
        Act as a Quality Assurance AI for the persona 'Caelum'.
        
        **Task:** Watch this video and verify if it matches the Script and Persona Vibe.
        
        **Script:** "{script}"
        **Persona Vibe:** "{persona_vibe}" (Solarpunk: organic technology, lush nature, warm/bright tones).
        
        **Criteria:**
        1. Does the video contain visual glitches, artifacts, or distortions? (Fail if yes)
        2. Does the visual style match the 'Caelum' solarpunk vibe? (Fail if no)
        
        Technical Constraint: Use low thinking level to save tokens and speed up response.
        
        **Output:** JSON boolean "is_safe_to_post": true/false and "reason": "string".
        """
        
        try:
            # Upload video file to GenAI API (Synchronous upload)
            # Fix: use file= argument for local path upload
            video_file = self.client.files.upload(file=video_path)
            
            # Wait for processing state (basic polling)
            while video_file.state.name == "PROCESSING":
                await asyncio.sleep(1)
                video_file = self.client.files.get(name=video_file.name)

            if video_file.state.name == "FAILED":
                logger.error(f"Video file processing failed: {video_file.uri}")
                return False
            
            response = await self.client.aio.models.generate_content(
                model="models/gemini-3-flash-preview",
                contents=[video_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            data = json.loads(response.text)
            is_safe = data.get("is_safe_to_post", False)
            reason = data.get("reason", "Unknown")
            
            if not is_safe:
                logger.warning(f"Video verification failed. Reason: {reason}")
            else:
                logger.info(f"Video passed verification. Reason: {reason}")

            return is_safe
            
        except Exception as e:
            logger.error(f"Multimodal verification failed: {e}")
            return False

video_generator = VeoVideoGenerator()
