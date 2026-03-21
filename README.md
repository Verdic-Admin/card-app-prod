# ⚾ Baseball Card Scanner

A Python script that scans a folder of baseball card images and uses the
**Google Gemini API** to extract structured data — Player Name, Team Name, Card
Set, and Parallel/Insert Type — into a CSV file.

---

## Prerequisites

- Python 3.10+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier
  works)

---

## Setup

### 1. Clone / download the project

```bash
cd card-app-prod
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Add your API key

Open the `.env` file and replace the placeholder with your real key:

```
GEMINI_API_KEY=AIza...your_key_here...
```

---

## Usage

Place your baseball card images (`.jpg`, `.jpeg`, `.png`, `.webp`) in any
folder, then run:

```bash
python scan_cards.py <path-to-image-folder>
```

### Example

```bash
python scan_cards.py ./cards
```

The script will:

1. Scan every supported image in the folder
2. Send each image to **Gemini 2.5 Flash** with a structured prompt
3. Wait **4 seconds** between API calls (free-tier rate limit)
4. Append each result as a new row in **`scanned_cards.csv`**

---

## Output — `scanned_cards.csv`

| filename    | player_name   | team_name           | card_set            | parallel_insert_type | raw_response |
| ----------- | ------------- | ------------------- | ------------------- | -------------------- | ------------ |
| card001.jpg | Mike Trout    | Los Angeles Angels  | 2023 Topps Series 1 | Base                 | {...}        |
| card002.png | Shohei Ohtani | Los Angeles Dodgers | 2024 Bowman Chrome  | Gold Refractor       | {...}        |

- If a field cannot be determined from the image, it will show `Unknown`.
- If a parse error occurs, fields will show `PARSE_ERROR` and the raw API
  response is preserved in `raw_response`.
- Running the script again will **append** new rows to the existing CSV rather
  than overwriting it.

---

## Supported Image Formats

`.jpg` · `.jpeg` · `.png` · `.webp` · `.gif` · `.bmp`

---

## Rate Limits

The script enforces a **4-second delay** between each API call to stay within
Gemini's free-tier limits (15 requests/minute). You can adjust `DELAY_SECONDS`
in `scan_cards.py` if you have a paid plan.

---

## Project Structure

```
card-app-prod/
├── scan_cards.py       # Main scanner script
├── requirements.txt    # Python dependencies
├── .env                # Your API key (never commit this!)
├── .gitignore          # Excludes .env and CSV from git
└── README.md           # This file
```

---

## Troubleshooting

| Problem                          | Solution                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `GEMINI_API_KEY not found`       | Make sure `.env` exists and contains your key                   |
| `No supported image files found` | Check the folder path and file extensions                       |
| `PARSE_ERROR` in CSV             | The model returned unexpected text; check `raw_response` column |
| Rate limit errors                | Increase `DELAY_SECONDS` in `scan_cards.py`                     |
