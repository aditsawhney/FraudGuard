console.log("content.js loaded");

const API_URL = "http://127.0.0.1:8000";

let lastProcessedUrl = "";

function safeSend(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (e) {
    // extension context invalidated
  }
}

function analyze() {
  console.log("analyze() called, path:", window.location.pathname);
  if (!LinkedInScraper.isJobPage()) {
    console.log("isJobPage() returned false, bailing");
    return;
  }
  if (window.location.href === lastProcessedUrl) {
    console.log("same URL, bailing");
    return;
  }
  lastProcessedUrl = window.location.href;

  const jobData = LinkedInScraper.scrape();
  console.log("scraped:", jobData);
  if (!jobData || !jobData.title) {
    console.log("no title, bailing");
    return;
  }
  
  if (!jobData.description && !window.location.pathname.startsWith("/jobs/collections/") && !window.location.pathname.startsWith("/jobs/view/")) {
    safeSend({ type: "ANALYSIS_RESULT", payload: {
      prediction: "unknown",
      confidence: 0,
      risk_level: "low",
      reasons: [],
      source: "local",
      title: jobData.title,
      company: jobData.company,
      unsupported: true,
    }});
    return;
  }
  
  safeSend({ type: "ANALYSIS_START" });

  fetchPrediction(jobData)
    .then((result) => {
      safeSend({ type: "ANALYSIS_RESULT", payload: result });
    })
    .catch(() => {
      const fallback = localHeuristic(jobData);
      safeSend({ type: "ANALYSIS_RESULT", payload: fallback });
    });
}

async function fetchPrediction(jobData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "FETCH_PREDICTION", payload: jobData }, (response) => {
        if (chrome.runtime.lastError || !response || response.error) {
          reject(new Error("Backend error"));
        } else {
          resolve(response);
        }
      });
    });
  }

function localHeuristic(jobData) {
  const text = `${jobData.title} ${jobData.description} ${jobData.contact}`.toLowerCase();
  const flags = [];

  const patterns = [
    [/aadhaar/i,                          "aadhaar number mentioned"],
    [/pan\s*card/i,                       "pan card mentioned"],
    [/whatsapp/i,                         "whatsapp-only contact"],
    [/registration\s*fee|joining\s*fee/i, "upfront fee mentioned"],
    [/guaranteed\s*(job|placement)/i,     "guaranteed job claim"],
    [/\d{10}/,                            "personal phone number in listing"],
    [/gmail\.com|yahoo\.com/i,            "personal email used for contact"],
    [/no\s*experience\s*required.*₹|earn.*per\s*day/i, "unrealistic pay claim"],
  ];

  for (const [pattern, reason] of patterns) {
    if (pattern.test(text)) flags.push(reason);
  }

  const confidence = Math.min(0.5 + flags.length * 0.1, 0.95);
  const prediction = flags.length >= 2 ? "fraud" : "real";
  const risk_level = flags.length >= 3 ? "high" : flags.length >= 1 ? "medium" : "low";

  return { prediction, confidence, risk_level, reasons: flags, source: "local", title: jobData.title, company: jobData.company };
}

let lastJobTitle = "";

function checkForNewJob() {
  const current = LinkedInScraper.scrape();
  if (current && current.title && current.description && current.title !== lastJobTitle) {
    lastJobTitle = current.title;
    lastProcessedUrl = "";
    analyze();
  }
}

setInterval(checkForNewJob, 1000);

setTimeout(analyze, 2500);