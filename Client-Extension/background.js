self.importScripts("config.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "classifyDomain") {
    const result = classifyDomain(message.url);
    const messages = getStatusMessage(result.status, result.domain, result.category, result.alternatives);
    sendResponse({ ...result, title: messages.title, message: messages.message });
  }
  return true;
});
