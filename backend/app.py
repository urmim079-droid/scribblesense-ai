from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import json
import os
import base64
import time
from groq import Groq

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# =========================
# GROQ CLIENT
# =========================
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Vision model with image support
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
# Text-only model for /ask endpoint
TEXT_MODEL = "llama-3.3-70b-versatile"


# =========================
# YOUR ORIGINAL PROMPT
# =========================
PROMPT = """You are a smart study assistant for students.
Analyse this handwritten notes image carefully.
Return ONLY a valid JSON object with exactly these 7 keys:

{
  "subject": "Physics or Maths or Chemistry or Biology or History or English or Computer Science or Other",
  "confidence": 85,
  "structured_notes": "# Heading\\n- bullet point\\n- **bold term**: explanation",
  "summary": "Sentence one. Sentence two. Sentence three.",
  "quiz": [
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "D. option"], "answer": "A"},
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "D. option"], "answer": "B"},
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "D. option"], "answer": "C"},
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "D. option"], "answer": "A"},
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "D. option"], "answer": "D"}
  ],
  "key_terms": [
    {"term": "term name", "definition": "definition here"},
    {"term": "term name", "definition": "definition here"},
    {"term": "term name", "definition": "definition here"},
    {"term": "term name", "definition": "definition here"},
    {"term": "term name", "definition": "definition here"}
  ],
  "study_tip": "one specific tip based on these notes"
}

IMPORTANT: Return ONLY valid JSON.
Do NOT include ```json or any extra text.
"""


# =========================
# GROQ VISION CALL
# =========================
def call_groq_vision(image_data: bytes, mime_type: str, language: str, retries: int = 3):
    """Send an image to Groq vision model and return the raw text response."""
    # Encode image as base64 data URL
    b64_image = base64.b64encode(image_data).decode("utf-8")
    image_url = f"data:{mime_type};base64,{b64_image}"

    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"{PROMPT}\nReturn ALL output in {language} language."
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            }
                        ]
                    }
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq vision attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(2)

    return None


# =========================
# GROQ TEXT CALL
# =========================
def call_groq_text(prompt: str, retries: int = 3):
    """Send a plain text prompt to Groq and return the response."""
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=1024,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq text attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(2)

    return None


# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return "ScribbleSense AI backend is running! (Powered by Groq + Llama 4 Scout)"


@app.route("/analyse", methods=["POST"])
def analyse():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image file received"}), 400

        file = request.files["image"]
        language = request.form.get("language", "English")

        image_data = file.read()

        response_text = call_groq_vision(image_data, file.content_type, language)

        if response_text is None:
            return jsonify({"error": "AI busy, please try again"}), 500

        response_text = response_text.strip()

        # Strip ```json fences if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            response_text = "\n".join(lines)

        try:
            result = json.loads(response_text)
            return jsonify(result)
        except Exception:
            print("RAW RESPONSE:\n", response_text)
            return jsonify({
                "error": "AI returned invalid JSON",
                "raw": response_text
            }), 500

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/ask", methods=["POST"])
def ask():
    try:
        data = request.json
        question = data.get("question", "")

        prompt = f"You are a helpful study assistant. Answer this question from a student's notes: {question}"

        answer = call_groq_text(prompt)

        if answer is None:
            return jsonify({"answer": "AI busy, please try again"})

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)})


# =========================
# RUN
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
