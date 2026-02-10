<div align="center">

# AIFluence

AIFluence is a platform that lets users create autonomous AI influencer personas capable of growing their own social media presence, entirely on autopilot.
Won 11k @ SpurHacks.

</div>

<img width="1461" height="738" alt="Screenshot 2025-09-21 at 9 27 22 PM" src="https://github.com/user-attachments/assets/0b20c643-8fdd-4323-a316-be0a051db355" />


## What It Does
Users initialize a virtual influencer by giving it a name, backstory, tone, goals, and preferred audience. From there, the system handles the entire content lifecycle:

- It generates reels and stories using multimodal models like **Veo 3** and **Gemini 2.5 Pro**.
- It schedules posts at your desired time.
- It directly publishes to **Instagram** via the official **Publishing API**.
- It builds a real-time digital identity and adapts based on user-defined objectives and "changes" to the persona's life

AIFluence supports two key use cases:
- **B2B**: Businesses can build persistent, custom brand ambassadors tailored to their market segment.
- **B2C**: Individual users or niche entrepreneurs can create lifestyle personas to explore passive-income opportunities—similar to dropshipping, but with content instead of products.


## How We Built It

**Frontend:**  
We used **Next.js** with **React** and **Tailwind CSS** to build an interactive onboarding and dashboard experience. The frontend lets users walk through persona creation, view posting history, and trigger or modify post schedules.

**Backend Server:**  
Our API server was built using **FastAPI**. It handles influencer initialization, scheduling, and communication with third-party services. It uses a local **SQLite** database to persist influencer data, metadata, and scheduling information.

**Video & Media Generation:**  
The most critical layer of AIFluence is our media generation pipeline, which connects multiple AI models to simulate influencer behavior:
- **Veo 3 (Runway)**: Used for high-quality, scene-based reel generation.
- **Gemini 2.5 Pro**: Used for generating photorealistic persona imagery and thumbnails based on persona attributes.
- **MoviePy** + **PIL**: For assembling final videos with overlayed captions, transitions, and branding.
- **Transformers (HuggingFace)** and **GPT-4o**: Used to write captions, develop storytelling scripts, and maintain a coherent voice across time.

**Instagram Integration:**  
We used the official **Instagram Graph API** (Publishing) to automate reel and story uploads on behalf of the AI personas. The FastAPI backend handles login sessions, scheduling, and post automation.

## Architecture Overview

1. **User onboarding**: User creates an influencer by filling out a brief profile (name, image, tone, goals, etc.)
2. **Persona is initialized**: Back-end assigns growth logic, generation cadence, and target audience.
3. **Content pipeline triggers**: Stories and reels are generated using LLMs + Veo 3 based on persona goals and timelines.
4. **Auto-scheduling**: Content is slotted into a weekly schedule via FastAPI logic.
5. **Publishing**: Media is uploaded directly to Instagram with appropriate metadata (captions, hashtags, etc.)
6. **Analytics (MVP)**: The system tracks posting intervals, response rates, and growth curves.


## Inspiration

Influencer marketing is booming, but it’s inefficient and expensive. Human influencers come with inconsistent availability, high costs, and limited scalability. We imagined a world where you could "design" an influencer that doesn't sleep, doesn't charge thousands per post, and aligns perfectly with your product or personal vision.

---

# (Previous Project) National Bank Bias Detector Challenge

## 🚀 Now Available as TradingView Extension!

This project now includes a **browser extension** that integrates directly with TradingView! See the [`extension/`](./extension/) folder for details.

## Web Application Version

A prototype tool that analyzes trading data to detect harmful psychological patterns and behavioral biases in retail trading.

## Features

### Bias Detection
The tool identifies three key behavioral biases:

1. **Overtrading**: Detects excessive trading frequency, rapid-fire trades, and strategy-less trading patterns
2. **Loss Aversion**: Identifies patterns of cutting winners short while holding losers, poor risk-reward ratios
3. **Revenge Trading**: Detects emotional trading immediately after losses, increased position sizes after losses

### Analysis & Feedback
- **Comprehensive Statistics**: Total trades, P&L, win rate, and trading patterns
- **Severity Scoring**: Each bias is scored 0-100 with severity levels (Low/Moderate/High)
- **Personalized Recommendations**: Actionable suggestions such as:
  - Daily trade limits
  - Stop-loss and take-profit discipline
  - Mandatory cooldown periods after losses
  - Position size management
- **Visual Insights**: Interactive charts showing:
  - P/L over time
  - Bias detection scores
  - Win/loss distribution

## Installation

1. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# OR on Windows: venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
# OR install directly:
pip install flask pandas numpy plotly werkzeug
```

## Usage

1. Activate the virtual environment (if you created one):
```bash
source venv/bin/activate  # On macOS/Linux
# OR on Windows: venv\Scripts\activate
```

2. Start the Flask server:
```bash
python3 app.py
```

2. Open your browser and navigate to `http://localhost:5001`

**Note:** Port 5000 is often used by Apple's AirPlay service on macOS, so the app runs on port 5001 by default to avoid conflicts.

3. Either:
   - Upload a CSV file with trading data (columns: Timestamp, Buy/sell, Asset, P/L)
   - Click "Use Mock Data" to test with generated sample data

## Data Format

Your CSV file should contain the following columns:
- **Timestamp**: Date/time of the trade (ISO format or standard date format)
- **Buy/sell**: Trade direction (Buy or Sell)
- **Asset**: Asset symbol (e.g., AAPL, TSLA, BTC)
- **P/L**: Profit/Loss amount (positive for profits, negative for losses)

Example:
```csv
Timestamp,Buy/sell,Asset,P/L
2024-01-15T10:30:00,Buy,AAPL,45.50
2024-01-15T14:20:00,Sell,AAPL,-23.00
```
