# Emotion Reader

Type a sentence and a Bidirectional GRU (BiGRU) model tells you which of six emotions it hears in it: **sadness, joy, love, anger, fear, surprise**.

The project covers the full path from raw text to a live website: data exploration, model comparison, a FastAPI backend, a custom HTML/CSS/JS frontend, and deployment on Render.

**Live demo:** [your-app.onrender.com](https://emotion-predictor-681h.onrender.com)
**Repo:** [Beingwithpk/emotion-predictor](https://github.com/Beingwithpk/emotion-predictor)

> The app runs on Render's free tier, which sleeps when idle. The first request after a while can take a minute while the server wakes up and loads the model. The status pill in the top corner of the page shows this.

---

## Features

- Predicts one of six emotions with a confidence score and the full probability breakdown.
- The page colour changes with the detected emotion, with animated probability bars and an emoji burst.
- Example sentences you can try in one click, a short session history, and `Ctrl + Enter` to analyze.
- Clear error messages when the model is still loading or the server is unreachable.
- Interactive API docs at `/docs`.

## Dataset

[`dair-ai/emotion`](https://huggingface.co/datasets/dair-ai/emotion) from Hugging Face: short English sentences labelled with one of six emotions.

| Split | Rows |
|-------|------|
| Train | ~16,000 |
| Test  | ~2,000 |

Labels: `sadness`, `joy`, `love`, `anger`, `fear`, `surprise`.

## How the model was built

1. **Mapped label ids to emotion names** so results are readable.
2. **Exploratory analysis.** A count plot showed the classes are imbalanced, with `joy` the largest.
3. **Text preprocessing.** Lowercasing, removing apostrophes and special characters, collapsing extra spaces, then tokenizing, converting to sequences, and padding to a fixed length.
4. **Shared training utilities.** Because of the class imbalance, class weights were computed and used during training so the model does not simply favour the majority class.
5. **Trained and compared four architectures** (details below).
6. **Chose the BiGRU** and ran an overall evaluation plus a bias analysis across classes.
7. **Wrapped the model in an API**, built a frontend, and deployed it.

### Model comparison

Shared settings for the first three models: vocabulary of 10,000 words, sequence length 50, dropout 0.5.

| Model | Loss | Accuracy | Verdict |
|-------|------|----------|---------|
| Simple RNN | 1.80 | 0.10 | Poor |
| LSTM | 1.82 | 0.112 | Poor |
| GRU | 1.77 | 0.118 | Poor |
| **Bidirectional GRU** | **0.21** | **0.92** | **Chosen** |

The first three barely learned anything, which points to a setup problem rather than a fair verdict on those architectures. One likely factor is that they read the sequence in one direction only and the padding sits at the end, so the final hidden state comes after a run of padding tokens. The bidirectional model also reads the sentence from the back, so it sees the real words last in one direction. Masking the padding would be the first thing to try for the one-directional models.

### Final architecture

```
Embedding (10,000 words → 300 dims)
Bidirectional GRU (128 units, returns sequences)
Dropout (0.5)
Bidirectional GRU (64 units)
Dropout (0.5)
Dense (6, softmax)
```

Loss: sparse categorical cross-entropy. Input: sequences of 50 tokens, padded and truncated at the end.

### Why a BiGRU works well for emotion detection

- **It reads context in both directions.** The meaning of a word often depends on what comes after it as well as before. "I am not happy about this" needs the model to connect "not" and "happy", and a bidirectional layer can use both sides of a word.
- **Gates handle long-range dependencies.** The update and reset gates let the network keep the parts of a sentence that matter for the emotion and drop the rest, which a plain RNN struggles to do.
- **It is lighter than an LSTM.** A GRU has fewer parameters, so it trains faster and is cheaper to serve on a small instance.
- **Stacking two layers adds depth.** The first layer produces a representation for every token, and the second summarizes it into one vector for classification.
- **Dropout reduces overfitting** on a dataset of short sentences.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serves the web UI |
| GET | `/health` | Server and model status |
| POST | `/predict` | Predicts the emotion of a sentence |
| GET | `/docs` | Interactive API documentation |

**Request**
```json
POST /predict
{ "text": "I feel so happy and excited" }
```

**Response**
```json
{
  "text": "I feel so happy and excited",
  "predicted_emotion": "joy",
  "confidence": 0.97,
  "all_probabilites": {
    "sadness": 0.004,
    "joy": 0.97,
    "love": 0.01,
    "anger": 0.004,
    "fear": 0.006,
    "surprise": 0.006
  }
}
```

The field is spelled `all_probabilites` in the backend and the frontend reads it that way. The values above are illustrative.

## Tech stack

- **Model:** TensorFlow / Keras (BiGRU), Keras `Tokenizer`
- **Backend:** FastAPI, Uvicorn, Pydantic
- **Frontend:** plain HTML, CSS and JavaScript, no frameworks
- **Hosting:** Render

## Project structure

```
emotion-predictor/
├── main.py                 # FastAPI app and model loading
├── Artifacts/
│   ├── BIGRU_Model.keras   # trained BiGRU model
│   └── tokenizer.pkl       # fitted tokenizer
├── Static/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── requirements.txt
└── runtime.txt
```

Folder and file names are case-sensitive in production. Keep them exactly as `main.py` refers to them.

## Run locally

```bash
git clone https://github.com/Beingwithpk/emotion-predictor
cd emotion-predictor

python -m venv .venv
# Windows: .venv\Scripts\activate    Mac/Linux: source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

Then open http://127.0.0.1:8000.

## Deploy on Render

1. Create a **Web Service** from the GitHub repo.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add an environment variable `PYTHON_VERSION` set to `3.11.9`.

TensorFlow is memory-heavy, so a small instance may run out of RAM when loading the model.

## Challenges and lessons

Building the model was not the hardest part. Deploying it was. Almost every problem came down to something that works on a laptop and breaks on a server:

- **Python version.** Render defaulted to Python 3.14, which has no TensorFlow builds. Setting `PYTHON_VERSION=3.11.9` fixed it. A `runtime.txt` file was not enough on its own.
- **Case-sensitive file names.** Windows treats `Static` and `static`, or `BIGRU_Model.keras` and `BiGRU_Model.keras`, as the same name. Render runs Linux and does not. This broke the static folder, the model path and the CSS and JS links.
- **Library version mismatch.** The model was saved with a pre-release Keras, and an older Keras on the server could not load it (an error about an unrecognised `quantization_config`). The fix was to use stable TensorFlow and Keras versions that can read the saved file.
- **Dictionary key spelling.** The model was stored under one key and read under another, which would have returned errors on every prediction request.
- **Missing files in git.** Model files and static assets have to be committed, and a `.gitignore` rule can silently leave them out.

The main lesson is to check names, versions and committed files before suspecting the code.

## Future improvements

- Evaluate on a held-out test set per class and report precision, recall and F1.
- Mask padding and retry the RNN and LSTM baselines for a fairer comparison.
- Try a pretrained transformer such as DistilBERT and compare it with the BiGRU.
- Convert the model to a lighter format to cut memory use and start-up time.
- Support multi-label emotions, since real sentences often express more than one.

## Author

**Pranjal**, B.Tech Computer Science, IIIT Bhopal.
