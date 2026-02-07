from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from bias_detector import BiasDetector
from mock_data_generator import MockDataGenerator

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        trades = data.get('trades', [])
        
        if not trades:
            return jsonify({'error': 'No trading data provided'}), 400
        
        # Convert to DataFrame
        df = pd.DataFrame(trades)
        
        # Ensure required columns exist
        required_cols = ['Timestamp', 'Buy/sell', 'Asset', 'P/L']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return jsonify({'error': f'Missing required columns: {missing_cols}'}), 400
        
        # Initialize bias detector
        detector = BiasDetector(df)
        
        # Detect all biases
        results = {
            'overtrading': detector.detect_overtrading(),
            'loss_aversion': detector.detect_loss_aversion(),
            'revenge_trading': detector.detect_revenge_trading(),
            'summary': detector.generate_summary(),
            'recommendations': detector.generate_recommendations(),
            'statistics': detector.get_statistics()
        }
        
        return jsonify(results)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mock-data', methods=['GET'])
def mock_data():
    """Generate mock trading data for testing"""
    generator = MockDataGenerator()
    mock_trades = generator.generate()
    return jsonify({'trades': mock_trades})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5001)
