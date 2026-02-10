import asyncio
import logging
import json
from enum import Enum
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from google.genai import types

# Import your DB models and getters
from database.models import get_db, Influencer
from managers.ai_generator import ai_generator
from managers.video_generator import video_generator

logger = logging.getLogger(__name__)

class AgentState(Enum):
    IDLE = "idle"
    PLANNING = "planning"
    WORKING = "working"  # Generating content, interacting
    RESTING = "resting"
    REFLECTING = "reflecting" # Analyzing sentiment, adjusting persona

class Memory:
    """
    Manages short-term and long-term memory for the Agent, 
    including sentiment tracking for 'Sentiment-Driven Growth'.
    """
    def __init__(self):
        self.short_term_history: List[Dict[str, Any]] = []
        self.sentiment_history: List[float] = [] # -1.0 to 1.0
        self.current_interests: List[str] = []
        self.consecutive_bad_moods: int = 0

        
    def add_interaction(self, interaction_data: Dict[str, Any], sentiment_score: float):
        self.short_term_history.append(interaction_data)
        self.sentiment_history.append(sentiment_score)
        # Keep history manageable
        if len(self.short_term_history) > 50:
            self.short_term_history.pop(0)
        if len(self.sentiment_history) > 50:
            self.sentiment_history.pop(0)
            
    def get_average_sentiment(self, last_n: int = 10) -> float:
        if not self.sentiment_history:
            return 0.0
        recent = self.sentiment_history[-last_n:]
        return sum(recent) / len(recent)

    async def update_sentiment(self, comments_list: List[str]) -> str:
        """
        Analyzes audience comments using Gemini 3 Flash to determine mood.
        Updates consecutive_bad_moods counter.
        """
        if not comments_list:
            return "Neutral"

        if not ai_generator.client:
            return "Neutral"

        prompt = f"""
        Analyze the following audience comments for 'Caelum' (Solarpunk Engineer).
        Comments: {comments_list}

        Determine the overall Audience Mood.
        Options: 'Positive', 'Neutral', 'Bored', 'Negative'.

        Output JSON: {{"mood": "string", "reasoning": "string"}}
        """

        try:
            response = await ai_generator.client.aio.models.generate_content(
                model="models/gemini-3-flash-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            data = json.loads(response.text)
            mood = data.get("mood", "Neutral")
            logger.info(f"Audience Mood Analysis: {mood} ({data.get('reasoning')})")

            if mood in ["Bored", "Negative"]:
                self.consecutive_bad_moods += 1
            else:
                 self.consecutive_bad_moods = 0 # Reset if mood improves
            
            return mood
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            return "Neutral"

    def trigger_persona_pivot(self, current_interests: List[str]) -> bool:
        """
        Checks if a pivot is needed based on sentiment drift.
        Returns True if a pivot should occur.
        """
        avg_sentiment = self.get_average_sentiment(10)
        logger.info(f"Current average sentiment: {avg_sentiment} | Consecutive Bad Moods: {self.consecutive_bad_moods}")
        
        # If sentiment is consistently low (< -0.2) or stagnant (close to 0 for too long), pivot.
        # ALSO trigger if consecutive bad moods (Bored/Negative) >= 3
        if avg_sentiment < -0.2 or self.consecutive_bad_moods >= 3:
            logger.warning("Sentiment is negative or audience is bored. Triggering Persona Pivot.")
            self.consecutive_bad_moods = 0 # Reset after triggering
            return True
        return False

class AgentCore:
    """
    The Reactive Agent Core.
    Runs a continuous loop to perceive the world, decide on actions, and execute them.
    """
    def __init__(self):
        self.state = AgentState.IDLE
        self.memory = Memory()
        self.loop_interval = 10 # seconds (check every 10s for demo)
        self._is_running = False
        
        # State for Status Endpoint
        self.last_roi_score: float = 0.0
        self.current_mood: str = "Neutral"
        self.recent_activity: List[str] = []
        self.current_persona_interests: List[str] = []
        
        # Focus State
        self.active_influencer_id: Optional[int] = None
        
        # Manual Trigger Override
        self.next_trend_override: Optional[str] = None

    def inject_trend(self, trend: str):
        """Manually injects a trend to be evaluated immediately (next tick)."""
        self.next_trend_override = trend
        self.log_activity(f"INJECTED TREND: {trend}")

    def set_active_influencer(self, influencer_id: int):
        """Sets the agent's focus to a specific influencer."""
        self.active_influencer_id = influencer_id
        self.log_activity(f"SWITCHED FOCUS: Influencer ID {influencer_id}")

    def log_activity(self, message: str):
        """Logs activity to logger and keeps recent history."""
        logger.info(message)
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.recent_activity.append(f"[{timestamp}] {message}")
        if len(self.recent_activity) > 5:
            self.recent_activity.pop(0)

    def start(self):
        """Starts the agent loop."""
        if self._is_running:
            return
        self._is_running = True
        logger.info("Agent Core started.")
        asyncio.create_task(self._run_loop())

    def stop(self):
        self._is_running = False
        logger.info("Agent Core stopping...")

    async def _run_loop(self):
        while self._is_running:
            try:
                await self.tick()
            except Exception as e:
                logger.error(f"Error in Agent loop: {e}", exc_info=True)
            
            await asyncio.sleep(self.loop_interval)

    async def tick(self):
        """
        The heartbeat of the agent.
        1. Perceive: Check time, scheduled events, new interactions.
        2. Decide: Evaluate viral potential (ROI), check sentiment.
        3. Act: Generate content (Low/High cost), sleep, or pivot.
        """
        now = datetime.now()
        # self.log_activity(f"Agent Tick at {now} | State: {self.state}") # Too noisy for UI, maybe just log to console
        logger.info(f"Agent Tick at {now} | State: {self.state}")

        # 1. PERCEIVE & REFLECT
        db = next(get_db())
        try:
            if self.active_influencer_id:
                influencer = db.query(Influencer).filter(Influencer.id == self.active_influencer_id).first()
                if not influencer:
                    self.log_activity(f"Focused Influencer {self.active_influencer_id} not found. Reverting to default.")
                    self.active_influencer_id = None
                    influencer = db.query(Influencer).first()
            else:
                influencer = db.query(Influencer).first() 
            
            if not influencer:
                return
            
            # Sync interests for UI
            self.current_persona_interests = influencer.audience_targeting.get('interests', [])

            if self.state == AgentState.IDLE:
                 # Check memory for sentiment drift
                 # Simulate gathering comments for this tick (in real app, query DB)
                 recent_comments = ["Your content is okay I guess", "Boring...", "Not feeling this vibe anymore"] 
                 current_mood = await self.memory.update_sentiment(recent_comments)
                 
                 self.current_mood = current_mood
                 self.log_activity(f"Analyzed Audience Mood: {current_mood}")

                 if self.memory.trigger_persona_pivot(self.current_persona_interests):
                     self.state = AgentState.REFLECTING
                     self.log_activity("Triggering Persona Pivot due to negative sentiment.")
                     await self.execute_persona_pivot(influencer, db)
                     self.state = AgentState.IDLE
                     return
            
            # 2. DECIDE (Strategic Logic Gate)
            # Use override if present, otherwise default
            if self.next_trend_override:
                current_trend = self.next_trend_override
                self.next_trend_override = None # Consume it
                self.log_activity(f"MANUAL TRIGGER: Evaluating trend: {current_trend}")
            else:
                current_trend = "AI Agents in 2026" 
                self.log_activity(f"Evaluating trend: {current_trend}")
            roi_decision = await self.calculate_roi(current_trend, influencer)
            
            self.last_roi_score = roi_decision.get("score", 0.0)
            self.log_activity(f"ROI Decision: Score {self.last_roi_score} ({roi_decision.get('action')})")

            # 3. ACT
            action = roi_decision.get("action", "TEXT_POST")
            score = roi_decision.get("score", 0.0)
            
            if action == "VEO_VIDEO" and score >= 8:
                self.log_activity(f"Action: VEO_VIDEO (Score: {score}). Triggering High-Cost Action.")
                await self.perform_high_cost_action(influencer, current_trend)
            else:
                self.log_activity(f"Action: TEXT_POST (Score: {score}). Triggering Low-Cost Action.")
                await self.perform_low_cost_action(influencer, current_trend)

                
        except Exception as e:
            logger.error(f"Error in tick logic: {e}")
        finally:
            db.close()

    async def calculate_roi(self, trend_data: str, influencer) -> Dict[str, Any]:
        """
        Analyzes viral potential and decides next action using Gemini 3 Flash.
        Low thinking level to save tokens.
        """
        if not ai_generator.client:
             return {"score": 5.0, "action": "TEXT_POST", "reasoning": "AI Unavailable"}

        persona = influencer.persona or {}
        # Construct prompt based on persona 'Caelum'
        prompt = f"""
        Act as the Lead Backend Engineer for persona '{influencer.name}'.
        Persona Details:
        - Alert: Be 'Caelum' ({persona.get('tone', 'Modern')}).
        - Goals: {', '.join(persona.get('goals', []))}

        Analyze: Take the trend_data "{trend_data}" and evaluate it based on our persona.

        Score: Assign a ViralPotential score (0-10).

        Decision: 
        - If Score < 8: Set next_action = "TEXT_POST".
        - If Score >= 8: Set next_action = "VEO_VIDEO".

        Technical Constraint: Use the low thinking level to save tokens.

        Return: A JSON object {{"score": float, "action": str, "reasoning": str}}.
        """

        try:
            # Thinking config for "low thinking level" - budget 1024 tokens
            thinking_config = {"budget_token_count": 1024} 

            # Using Gemini 3 Flash
            response = await ai_generator.client.aio.models.generate_content(
                model="models/gemini-3-flash-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                   # thinking_config=thinking_config # Use if supported. Assuming prompt instruction guides it or safe defaults.
                )
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"ROI calculation in AgentCore failed: {e}")
            return {"score": 0.0, "action": "TEXT_POST", "reasoning": "Error"}

    async def perform_low_cost_action(self, influencer, topic):
        """Generates a text post or story."""
        # Simple generation using Gemini
        # For now, just log it
        logger.info(f"Generated text post about {topic}")
        # Update memory
        self.memory.add_interaction({"type": "text", "topic": topic}, sentiment_score=0.1)

    async def perform_high_cost_action(self, influencer, topic):
        """Generates a video using Veo + Verification."""
        self.state = AgentState.WORKING
        
        # 1. Generate Prompt
        prompt_data = ai_generator.generate_scene_prompt(influencer, context=f"Topic: {topic}")
        script = prompt_data.get("description", "")
        
        # 2. Generate Video (Veo)
        video_path = await video_generator.generate_video(script)
        
        if video_path:
            # 3. Verify (Gemini Multimodal)
            start_vibe = influencer.persona.get("tone", "neutral")
            is_valid = await video_generator.verify_content(video_path, script, start_vibe)
            
            if is_valid:
                logger.info("Video passed verification. Posting...")
                # Post logic here (InstagramManager)
                self.memory.add_interaction({"type": "video", "topic": topic}, sentiment_score=0.5)
            else:
                logger.warning("Video failed verification. Discarding.")
        
        self.state = AgentState.IDLE

    async def execute_persona_pivot(self, influencer, db):
        """
        Changes the agent's interests/personality nuances based on feedback.
        """
        logger.info("Executing Persona Pivot...")
        # Logic to ask Gemini to generate new interests
        # For now, just mock an update
        new_interests = ["Hydro-Politics", "Urban Rewilding", "Decentralized Energy"]
        # Update the dict (need to ensure SQLAlchemy detects change if using JSON type)
        targeting = dict(influencer.audience_targeting)
        targeting["interests"] = new_interests
        influencer.audience_targeting = targeting
        
        db.commit()
        logger.info(f"Persona pivoted. New interests: {new_interests}")

agent_core = AgentCore()
