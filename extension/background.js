const API_URL = "https://fraud-job-detector-1mdz.onrender.com";

let latestResult = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYSIS_START") {
    latestResult = null;
  }

  if (message.type === "ANALYSIS_RESULT") {
    latestResult = message.payload;
  }

  if (message.type === "GET_RESULT") {
    sendResponse(latestResult);
    return true;
  }

  if (message.type === "FETCH_PREDICTION") {
    fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((r) => r.json())
      .then((data) => {
        const result = { ...data, source: "model", title: message.payload.title, company: message.payload.company };
        latestResult = result;
        console.log("stored result:", result);
        sendResponse(result);
      })
      .catch(() => sendResponse({ error: true }));
    return true;
  }
});