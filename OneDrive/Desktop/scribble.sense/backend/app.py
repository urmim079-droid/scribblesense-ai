from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import json
import os
import time
from google import genai

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# MULTIPLE API KEYS
API_KEYS = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3")
]

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
"""


def call_gemini_with_retry(contents, retries=5):
    for attempt in range(retries):
        for key in API_KEYS:
            try:
                client = genai.Client(api_key=key)

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents
                )

                if response and response.text:
                    return response

            except Exception as e:
                print(f"Retry {attempt+1} Key failed:", e)

        time.sleep(2)

    return None


@app.route("/")
def home():
    return "ScribbleSense AI backend is running!"


@app.route("/analyse", methods=["POST"])
def analyse():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image file received"}), 400

        file = request.files["image"]
        language = request.form.get("language", "English")

        image_data = file.read()

        contents = [
            {
                "role": "user",
                "parts": [
                    {
                        "text": f"{PROMPT}\nReturn ALL output in {language} language."
                    },
                    {
                        "inline_data": {
                            "mime_type": file.content_type,
                            "data": image_data
                        }
                    }
                ]
            }
        ]

        response = call_gemini_with_retry(contents)

        if response is None:
            return jsonify({"error": "AI busy, try again"}), 500

        response_text = response.text.strip()

        if response_text.startswith("```"):
            lines = response_text.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            response_text = "\n".join(lines)

        try:
            result = json.loads(response_text)
            return jsonify(result)

        except:
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
        question = data.get("question")

        contents = f"Answer from student's notes: {question}"

        response = call_gemini_with_retry(contents)

        if response is None:
            return jsonify({"answer": "AI busy, try again"})

        return jsonify({
            "answer": response.text
        })

    except Exception as e:
        return jsonify({"error": str(e)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port) 