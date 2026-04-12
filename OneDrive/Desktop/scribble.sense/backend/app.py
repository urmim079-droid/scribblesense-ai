from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import base64
import json
import os
from google import genai

load_dotenv()

app = Flask(__name__)

# Fix CORS completely - allow ALL origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Gemini API setup (NEW)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
    {"question": "question here", "options": ["A. option", "B. option", "C. option", "C. option"], "answer": "D"}
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

IMPORTANT: Return ONLY the JSON. No extra text. No backticks. No markdown.
"""


@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response


@app.route("/")
def home():
    return "ScribbleSense AI backend is running!"

@app.route("/analyse", methods=["POST", "OPTIONS"])
def analyse():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        if "image" not in request.files:
            return jsonify({"error": "No image file received"}), 400

        file = request.files["image"]

        if file.filename == "":
            return jsonify({"error": "Empty file"}), 400

        image_data = file.read()

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": PROMPT},
                        {
                            "inline_data": {
                                "mime_type": file.content_type,
                                "data": image_data
                            }
                        }
                    ]
                }
            ]
        )

        response_text = response.text.strip()

        if response_text.startswith("```"):
            lines = response_text.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            response_text = "\n".join(lines)

        result = json.loads(response_text)
        return jsonify(result)

    except Exception as e:
        print("ERROR:",e)
        return jsonify({"error": str(e)}), 500
    
if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")    

 