 // ============================================================
// ScribbleSense AI — script.js
// This file runs in the BROWSER (not on your server)
// It does 4 things:
//   1. Takes the photo the user uploaded
//   2. Sends it to your Python backend (app.py)
//   3. Receives the JSON result from Claude
//   4. Displays all 4 sections on the page
// ============================================================

// Your backend URL — while testing locally use this
// When you deploy to Render, replace with your Render URL
const BACKEND_URL = "http://127.0.0.1:5000/analyse";

// ============================================================
// MAIN FUNCTION — runs when user clicks "Analyse Notes"
// ============================================================
async function analysePhoto() {

  // Step 1: Get the photo the user selected
  const fileInput = document.getElementById("photo-input");
  const file = fileInput.files[0];

  // If no photo selected, tell the user
  if (!file) {
    alert("Please select a photo of your notes first!");
    return;
  }

  // Step 2: Show the loading spinner, hide old results
  showLoading(true);
  document.getElementById("results-section").style.display = "none";
  document.getElementById("error-box").style.display = "none";

  // Step 3: Show preview of the uploaded photo
  showPhotoPreview(file);

  // Step 4: Package the photo into FormData (like a form submission)
  const formData = new FormData();
  formData.append("image", file);
  // "image" must match what app.py reads: request.files['image']

  try {
    // Step 5: Send the photo to your Python backend
    const response = await fetch(BACKEND_URL, {
      method: "POST",      // POST = we are sending data
      body: formData       // the photo is inside formData
    });

    // Step 6: Check if the server responded correctly
    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    // Step 7: Convert the response to a JavaScript object
    const data = await response.json();

    // Step 8: Check if Claude returned an error
    if (data.error) {
      throw new Error(data.error);
    }

    // Step 9: Hide loading, show all results
    showLoading(false);
    displayAllResults(data);

  } catch (err) {
    // If anything went wrong, show a friendly error message
    showLoading(false);
    showError(err.message);
  }
}


// ============================================================
// DISPLAY FUNCTIONS — each one fills in one section
// ============================================================

function displayAllResults(data) {
  // Show the results section (it was hidden before)
  document.getElementById("results-section").style.display = "block";

  // Fill in all 5 sections one by one
  displaySubjectBadge(data.subject, data.confidence);
  displayNotes(data.structured_notes);
  displaySummary(data.summary);
  displayQuiz(data.quiz);
  displayKeyTerms(data.key_terms);
  displayStudyTip(data.study_tip);

  // Smoothly scroll down to show results
  document.getElementById("results-section").scrollIntoView({
    behavior: "smooth"
  });
}


// ---- UNIQUE FEATURE 1: Subject badge + confidence ring ----
function displaySubjectBadge(subject, confidence) {
  const container = document.getElementById("subject-area");

  // Pick a color for each subject
  const colors = {
    "Physics":          { bg: "#E6F1FB", text: "#0C447C", border: "#378ADD" },
    "Maths":            { bg: "#EEEDFE", text: "#3C3489", border: "#7F77DD" },
    "Chemistry":        { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
    "Biology":          { bg: "#EAF3DE", text: "#27500A", border: "#639922" },
    "History":          { bg: "#FAEEDA", text: "#633806", border: "#BA7517" },
    "Computer Science": { bg: "#FAECE7", text: "#712B13", border: "#D85A30" },
    "English":          { bg: "#FBEAF0", text: "#72243E", border: "#D4537E" },
    "Other":            { bg: "#F1EFE8", text: "#444441", border: "#888780" }
  };

  const c = colors[subject] || colors["Other"];

  // Pick ring color based on confidence level
  // Green = good (80+), Amber = okay (60-79), Red = poor (<60)
  const ringColor = confidence >= 80 ? "#1D9E75"
                  : confidence >= 60 ? "#EF9F27"
                  : "#E24B4A";

  // The confidence ring is an SVG circle
  // stroke-dasharray works like this: the filled part = confidence number, gap = 100 - confidence
  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:1.5rem;">

      <span style="
        background:${c.bg};
        color:${c.text};
        border:1.5px solid ${c.border};
        padding:6px 18px;
        border-radius:20px;
        font-size:14px;
        font-weight:500;">
        ${subject}
      </span>

      <div style="display:flex; align-items:center; gap:8px;">
        <svg width="52" height="52" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9"
            fill="none" stroke="#e0e0e0" stroke-width="3"/>
          <circle cx="18" cy="18" r="15.9"
            fill="none"
            stroke="${ringColor}"
            stroke-width="3"
            stroke-dasharray="${confidence} 100"
            stroke-linecap="round"
            transform="rotate(-90 18 18)"/>
          <text x="18" y="22"
            text-anchor="middle"
            font-size="9"
            font-weight="500"
            fill="${ringColor}">${confidence}%</text>
        </svg>
        <div>
          <div style="font-size:12px; font-weight:500; color:var(--color-text-primary)">
            Readability
          </div>
          <div style="font-size:11px; color:var(--color-text-secondary)">
            ${confidence >= 80 ? "Clear notes" : confidence >= 60 ? "Mostly readable" : "Hard to read"}
          </div>
        </div>
      </div>

    </div>
  `;
}


// ---- CORE FEATURE: Structured notes ----
function displayNotes(markdownText) {
  const container = document.getElementById("notes-output");

  // Convert simple markdown to HTML manually
  // # Heading → <h3>
  // **bold** → <strong>
  // - bullet → <li>
  let html = markdownText
    .replace(/^### (.+)$/gm, "<h4 style='font-size:14px;font-weight:500;margin:12px 0 4px'>$1</h4>")
    .replace(/^## (.+)$/gm,  "<h3 style='font-size:15px;font-weight:500;margin:14px 0 4px'>$1</h3>")
    .replace(/^# (.+)$/gm,   "<h2 style='font-size:16px;font-weight:500;margin:16px 0 6px'>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm,   "<li style='margin:4px 0;font-size:13px'>$1</li>")
    .replace(/\n/g, "<br>");

  container.innerHTML = html;
}


// ---- CORE FEATURE: Summary ----
function displaySummary(summaryText) {
  const container = document.getElementById("summary-output");
  container.innerHTML = `
    <p style="font-size:13px; color:var(--color-text-secondary); line-height:1.8; margin:0">
      ${summaryText}
    </p>
  `;
}


// ---- UNIQUE FEATURE 2: Interactive quiz with live scoring ----
function displayQuiz(quizArray) {
  const container = document.getElementById("quiz-output");

  // score tracking
  let score = 0;
  let answered = 0;
  const total = quizArray.length;

  let html = `<div id="quiz-score-bar" style="
    font-size:13px; font-weight:500;
    color:var(--color-text-secondary);
    margin-bottom:12px;">
    Score: <span id="score-display">0</span> / ${total}
  </div>`;

  quizArray.forEach((q, index) => {
    html += `
      <div style="
        background:var(--color-background-secondary);
        border-radius:8px;
        padding:12px 14px;
        margin-bottom:10px;"
        id="q-block-${index}">

        <p style="font-size:13px; font-weight:500; color:var(--color-text-primary); margin:0 0 10px">
          Q${index + 1}. ${q.question}
        </p>

        <div style="display:flex; flex-direction:column; gap:6px;">
          ${q.options.map(opt => `
            <button
              onclick="checkAnswer(${index}, '${opt[0]}', '${q.answer}', this)"
              style="
                text-align:left;
                padding:8px 12px;
                border-radius:6px;
                border:0.5px solid var(--color-border-secondary);
                background:var(--color-background-primary);
                font-size:12px;
                color:var(--color-text-primary);
                cursor:pointer;
                transition:background 0.2s;">
              ${opt}
            </button>
          `).join("")}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// Called when user clicks a quiz option
function checkAnswer(questionIndex, selected, correct, buttonEl) {
  // Get all buttons for this question and disable them
  const block = document.getElementById("q-block-" + questionIndex);
  const buttons = block.querySelectorAll("button");

  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = "default";

    // Highlight correct answer in green
    if (btn.textContent.trim().startsWith(correct)) {
      btn.style.background = "#E1F5EE";
      btn.style.borderColor = "#1D9E75";
      btn.style.color = "#085041";
    }
  });

  // Highlight the user's choice
  if (selected === correct) {
    // Correct! Green
    buttonEl.style.background = "#E1F5EE";
    buttonEl.style.borderColor = "#1D9E75";
    buttonEl.style.color = "#085041";

    // Update score
    const scoreEl = document.getElementById("score-display");
    scoreEl.textContent = parseInt(scoreEl.textContent) + 1;
  } else {
    // Wrong! Red
    buttonEl.style.background = "#FCEBEB";
    buttonEl.style.borderColor = "#E24B4A";
    buttonEl.style.color = "#A32D2D";
  }
}


// ---- CORE FEATURE: Key terms ----
function displayKeyTerms(termsArray) {
  const container = document.getElementById("keyterms-output");

  const html = termsArray.map(item => `
    <div style="
      display:flex; gap:12px; align-items:flex-start;
      padding:10px 0;
      border-bottom:0.5px solid var(--color-border-tertiary);">
      <span style="
        font-size:12px; font-weight:500;
        color:#0C447C;
        background:#E6F1FB;
        padding:3px 10px;
        border-radius:12px;
        white-space:nowrap;
        flex-shrink:0;">
        ${item.term}
      </span>
      <span style="font-size:12px; color:var(--color-text-secondary); line-height:1.6">
        ${item.definition}
      </span>
    </div>
  `).join("");

  container.innerHTML = html;
}


// ---- UNIQUE FEATURE 3: Personalised study tip ----
function displayStudyTip(tip) {
  const container = document.getElementById("studytip-output");
  container.innerHTML = `
    <div style="
      display:flex; gap:12px; align-items:flex-start;">
      <div style="
        font-size:20px; flex-shrink:0; margin-top:2px">
        💡
      </div>
      <p style="
        font-size:13px;
        color:#633806;
        line-height:1.7;
        margin:0;">
        ${tip}
      </p>
    </div>
  `;
}


// ============================================================
// PDF DOWNLOAD — converts results to downloadable PDF
// ============================================================
 function downloadPDF() {

  const element = document.querySelector(".results-inner");

  // Expand scrollable cards before capture
  const cards = document.querySelectorAll(".card-body");
  cards.forEach(card => {
    card.style.maxHeight = "none";
    card.style.overflow = "visible";
  });

  const options = {
    margin: 5,
    filename: "scribble-sense-notes.pdf",
    image: { type: "jpeg", quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    }
  };

  setTimeout(() => {
    html2pdf()
      .set(options)
      .from(element)
      .save();
  }, 600);
}


// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Show or hide the loading spinner
function showLoading(isLoading) {
  document.getElementById("loading-spinner").style.display =
    isLoading ? "flex" : "none";
  document.getElementById("analyse-btn").disabled = isLoading;
  document.getElementById("analyse-btn").textContent =
    isLoading ? "Analysing..." : "Analyse Notes";
}

// Show a preview of the uploaded photo
function showPhotoPreview(file) {
  const preview = document.getElementById("photo-preview");
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// Show a friendly error message
function showError(message) {
  const box = document.getElementById("error-box");
  box.style.display = "block";
  box.textContent = "Something went wrong: " + message +
    ". Make sure your Python backend is running (python app.py).";
}

// Allow drag and drop on the upload area
function setupDragDrop() {
  const dropZone = document.getElementById("drop-zone");

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#1D9E75";
    dropZone.style.background  = "#E1F5EE";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "";
    dropZone.style.background  = "";
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "";
    dropZone.style.background  = "";
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      document.getElementById("photo-input").files = e.dataTransfer.files;
      showPhotoPreview(file);
    }
  });
}

// Run setup when page loads
window.onload = function() {
  setupDragDrop();
};


// ============================================================
// EXTRA FUNCTIONS needed by index.html
// ============================================================

// Called when user picks a file using the file input
function handleFileSelect(input) {
  const file = input.files[0];
  if (file) {
    showPhotoPreview(file);
  }
}

// Reset everything — go back to upload screen
function resetApp() {
  document.getElementById("results-section").style.display = "none";
  document.getElementById("preview-wrap").style.display    = "none";
  document.getElementById("drop-zone").style.display       = "flex";
  document.getElementById("photo-input").value             = "";
  document.getElementById("error-box").style.display       = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Override showPhotoPreview to also swap drop-zone for preview
const _origPreview = showPhotoPreview;
function showPhotoPreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById("photo-preview").src      = e.target.result;
    document.getElementById("preview-wrap").style.display = "block";
    document.getElementById("drop-zone").style.display    = "none";
  };
  reader.readAsDataURL(file);
}