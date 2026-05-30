# Indian Job Fraud Detector

A Chrome extension that detects fraudulent job postings on LinkedIn in real time, built specifically for the Indian job market. The extension scrapes job details from the page, sends them to a FastAPI backend, and displays a risk score with human-readable explanations directly in the popup.

---

## Motivation

Job fraud is a significant problem in India — scams involving upfront registration fees, Aadhaar/PAN collection, WhatsApp-only contacts, and MNC impersonation are widespread. No publicly labeled dataset of Indian job fraud existed, so this project builds one from scratch and trains a model on it.

---

## How it works

1. The Chrome extension scrapes job fields (title, company, location, salary, description) from a LinkedIn job posting.
2. The content script sends the data to a FastAPI backend via the service worker (to bypass CORS restrictions on loopback addresses).
3. The backend runs a hybrid TF-IDF + Indian feature model and returns a prediction, confidence score, risk level, and list of reasons.
4. If the backend is unreachable, a local heuristic scorer runs as fallback.
5. Results are displayed in the popup with a colour-coded risk band and flag list.

---

## Dataset

Three-source hybrid — 2,118 rows total.

| Source | Rows | Label |
|--------|------|-------|
| Groq-generated synthetic Indian jobs | 452 | real |
| Groq-generated synthetic Indian jobs | 300 | fraud |
| EMSCAD benchmark dataset | 500 | real |
| EMSCAD benchmark dataset | 866 | fraud |

The 300 synthetic fraud rows cover 6 Indian-specific archetypes (50 each): fee-based scams, data harvesting, guaranteed placement, simple task scams, MNC impersonation, and overseas visa fraud. These were generated using `data_pipeline/generate_dataset.py`, grounded in a documented taxonomy in `data_pipeline/indian_fraud_taxonomy.py`.

The EMSCAD rows add real human-written Western scam postings to diversify the fraud class beyond purely synthetic data.

The EMSCAD dataset is sourced from the University of the Aegean's Laboratory of Information & Communication Systems Security. Citation: "Employment Scam Aegean Dataset", University of the Aegean, 2014. Available on Kaggle: https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction

---

## Model

**Architecture:** `CombinedFeatureExtractor` — a single sklearn transformer that computes:
- TF-IDF (1–2 ngrams, 30k features, sublinear_tf)
- 15 hand-crafted Indian fraud regex features
- 2 meta-features: `total_flags`, `flag_density`

These are hstacked into one sparse matrix and fed into a `LogisticRegression` classifier (`class_weight='balanced'`, C=1.0).

Logistic regression was chosen deliberately: `coef_` gives direct feature-level explainability, inference is fast enough for Render's free tier, and the dataset (2,118 rows) is too small to justify deep models.

**Performance** (evaluated on held-out test set of 318 rows):

| Metric | Score |
|--------|-------|
| Accuracy | 0.94 |
| Fraud F1 | 0.94 |
| Real F1 | 0.93 |

Confusion matrix: 8 false positives, 12 false negatives.

**Caveat:** the real class is majority synthetic. These metrics likely overstate real-world performance — no evaluation on genuine LinkedIn postings has been done yet.

### 15 Indian fraud features

`fee_language` · `upfront_payment` · `unrealistic_salary` · `guaranteed_job` · `whatsapp_only` · `gmail_contact` · `personal_phone` · `aadhaar_request` · `pan_request` · `bank_details_early` · `mnc_impersonation` · `background_check_fee` · `overseas_visa_fee` · `simple_task_scam` · `vague_company`

---

## Project structure

```
fraud-job-detector/
├── data/
│   ├── raw/
│   │   ├── synthetic_indian_jobs.csv
│   │   └── emscad_fake_job_postings.csv
│   └── processed/
│       ├── train.csv
│       ├── val.csv
│       ├── test.csv
│       └── dataset_metadata.json
├── data_pipeline/
│   ├── indian_fraud_taxonomy.py   ← 6 fraud archetypes, documented
│   ├── generate_dataset.py        ← Groq-based synthetic data generation
│   └── merge_datasets.py          ← combines synthetic + EMSCAD
├── model/
│   ├── features.py                ← CombinedFeatureExtractor (shared with backend)
│   ├── train.py
│   ├── model.pkl
│   ├── evaluation_report.json
│   └── top_features.json
├── backend/
│   ├── app.py                     ← FastAPI, POST /predict
│   └── requirements.txt
└── extension/
    ├── manifest.json
    ├── content.js
    ├── background.js
    ├── popup.html / popup.js / popup.css
    └── sites/
        └── linkedin.js            ← DOM scraper
```

---

## Running locally

**Backend**

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

The backend runs at `http://127.0.0.1:8000`. The `model/features.py` file must be present alongside `app.py` for the pickle to deserialise correctly.

**Extension**

1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select the `extension/` folder
4. Navigate to a LinkedIn job posting under `linkedin.com/jobs/collections/` or `linkedin.com/jobs/view/`

---

## API

`POST /predict`

Request:
```json
{
  "title": "Software Engineer",
  "company": "Acme Corp",
  "location": "Bangalore",
  "salary": "₹8-12 LPA",
  "contact": "",
  "description": "..."
}
```

Response:
```json
{
  "prediction": "fraud",
  "confidence": 0.91,
  "risk_level": "High",
  "reasons": ["aadhaar number requested upfront", "whatsapp-only contact"],
  "top_model_features": ["indian_aadhaar_request", "indian_whatsapp_only"]
}
```

---

## Author

Built by [Adit Sawhney](https://github.com/aditsawhney)

---

## Known limitations

- Metrics are measured on a partially synthetic dataset and likely overstate real-world performance.
- Short legitimate company names (e.g. EY, TCS) occasionally trip the `vague_company` feature.
- LinkedIn's search results layout (`/jobs/search-results/`) uses obfuscated class names and is not currently supported — the extension prompts users to open the full job view instead.
- The extension requires the backend to be running for full model predictions; local heuristics serve as fallback.