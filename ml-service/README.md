# ML Service - Smart Itinerary Planner

Machine Learning service for training and serving recommendation models.

## 📁 Project Structure

```
ml-service/
├── dataset/
│   ├── places.csv              # Exported from MongoDB
│   └── place_features.csv      # Generated with sentiment scores
├── models/
│   ├── sentiment_model.pkl     # Trained sentiment classifier
│   ├── vectorizer.pkl          # TF-IDF vectorizer
│   └── recommendation_model.pkl # Trained recommendation model
├── scripts/
│   └── (utility scripts)
├── train_sentiment.py          # Train sentiment model
├── create_features.py          # Generate feature dataset
├── train_recommendation.py     # Train recommendation model
├── train_pipeline.py           # Complete training pipeline
├── app.py                      # ML inference API
└── requirements.txt            # Python dependencies
```

## 🚀 Quick Start

### 1. Setup Python Environment

```bash
cd ml-service
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Export Dataset from MongoDB

```bash
cd ../Backend
node scripts/exportPlacesDataset.js
```

This will create `ml-service/dataset/places.csv` with ~6500 places.

### 3. Train Models

#### Option A: Run Complete Pipeline (Recommended)
```bash
cd ../ml-service
python train_pipeline.py
```

This runs all training steps automatically:
1. Train sentiment model
2. Generate features
3. Train recommendation model

#### Option B: Run Individual Steps
```bash
# Step 1: Train sentiment model
python train_sentiment.py

# Step 2: Generate features
python create_features.py

# Step 3: Train recommendation model
python train_recommendation.py
```

## 📊 Models

### 1. Sentiment Model
- **Algorithm**: Logistic Regression with TF-IDF
- **Input**: Review text
- **Output**: Sentiment score (0-1)
- **Purpose**: Analyze review sentiment for better recommendations

### 2. Recommendation Model
- **Algorithm**: Random Forest Classifier
- **Input**: Rating + Sentiment
- **Output**: Recommend (1) or Not (0)
- **Purpose**: Predict high-quality places

## 📈 Expected Results

With ~6500 places:
- **Sentiment Model Accuracy**: ~85-90%
- **Recommendation Model Accuracy**: ~90-95%
- **Training Time**: 2-5 minutes total

## 🧪 Testing Models

After training, test the models:

```python
import joblib
import numpy as np

# Load models
sentiment_model = joblib.load('models/sentiment_model.pkl')
vectorizer = joblib.load('models/vectorizer.pkl')
recommendation_model = joblib.load('models/recommendation_model.pkl')

# Test sentiment
review = "Amazing place with beautiful views!"
review_vec = vectorizer.transform([review])
sentiment = sentiment_model.predict_proba(review_vec)[0][1]
print(f"Sentiment: {sentiment:.2f}")

# Test recommendation
features = np.array([[4.5, 0.85]])  # [rating, sentiment]
recommend = recommendation_model.predict(features)[0]
print(f"Recommend: {'Yes' if recommend == 1 else 'No'}")
```

## 📝 Dataset Format

### places.csv
```csv
name,category,rating,review,city,lat,lng
"Fort Kochi","tourist attraction",4.6,"Beautiful historic fort","kochi",9.96,76.24
"Munnar Tea Gardens","park",4.8,"Amazing tea plantations","munnar",10.09,77.06
```

### place_features.csv
```csv
name,category,rating,sentiment,city,lat,lng
"Fort Kochi","tourist attraction",4.6,0.92,"kochi",9.96,76.24
"Munnar Tea Gardens","park",4.8,0.95,"munnar",10.09,77.06
```

## 🔧 Troubleshooting

### Issue: "dataset/places.csv not found"
**Solution**: Run the export script first:
```bash
cd ../Backend
node scripts/exportPlacesDataset.js
```

### Issue: "Not enough reviews for training"
**Solution**: Ensure MongoDB has places with reviews. Run the Kerala seeder if needed.

### Issue: "Module not found"
**Solution**: Install dependencies:
```bash
pip install -r requirements.txt
```

### Issue: Low model accuracy
**Solution**: 
- Collect more data (more places with reviews)
- Adjust model hyperparameters
- Check data quality

## 📚 Next Steps

After training models:
1. ✅ Verify models exist in `models/` directory
2. ✅ Test models with sample data
3. ✅ Start ML inference API (`python app.py`)
4. ⏳ Integrate backend routes to call ML API endpoints
4. ✅ Deploy ML service for inference

## 🎯 Phase 2 Checklist

- [x] Dataset exported from MongoDB
- [x] Sentiment model trained
- [x] Feature dataset generated
- [x] Recommendation model trained
- [x] Models saved for inference
- [x] ML inference API implemented (`app.py`)
- [ ] Backend-to-ML API integration complete

## 📊 Model Performance Metrics

Track these metrics after training:

**Sentiment Model:**
- Accuracy
- Precision/Recall for positive/negative
- F1-Score

**Recommendation Model:**
- Accuracy
- Feature importance (rating vs sentiment)
- Cross-validation score

## 🔄 Retraining Models

To retrain with new data:

1. Export fresh dataset from MongoDB
2. Run training pipeline again
3. Models will be overwritten with new versions

```bash
cd ../Backend
node scripts/exportPlacesDataset.js

cd ../ml-service
python train_pipeline.py
```

## 📞 Support

For issues or questions:
- Check troubleshooting section
- Review training logs
- Verify dataset quality
- Check Python version (3.8+ required)

---

**Phase**: 2.5 - Dataset Export + Model Training Hardening
**Status**: ✅ Ready for model training and inference API smoke tests
**Next**: Phase 3 - Backend integration with ML API
