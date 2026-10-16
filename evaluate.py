import pickle, re, numpy as np
from datasets import load_dataset
from keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sklearn.metrics import classification_report, confusion_matrix

def preprocess_text(t):
    t = t.lower()
    t = re.sub(r"'", "", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

model = load_model("Artifacts/BIGRU_Model.keras")
tok = pickle.load(open("Artifacts/tokenizer.pkl", "rb"))

ds = load_dataset("dair-ai/emotion")["test"]
texts = [preprocess_text(t) for t in ds["text"]]
X = pad_sequences(tok.texts_to_sequences(texts), maxlen=50, padding="post", truncating="post")

pred = np.argmax(model.predict(X), axis=1)
print("accuracy:", (pred == np.array(ds["label"])).mean())
print(confusion_matrix(ds["label"], pred))
print(classification_report(ds["label"], pred,
      target_names=["sadness","joy","love","anger","fear","surprise"]))