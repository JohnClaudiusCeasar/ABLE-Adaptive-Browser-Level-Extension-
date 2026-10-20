/**
 * ABLE Extension - Welcome Page Script
 *
 * Hosts the greeting modal on the dedicated onboarding tab and handles the
 * post-acknowledgment state.
 *
 * This tab is the guaranteed delivery surface for the first-run greeting: it
 * opens no matter what the user was browsing, so an install that lands on the
 * Chrome Web Store still shows the greeting immediately.
 */

document.addEventListener("DOMContentLoaded", function () {
  var successState = document.getElementById("welcomeSuccessState");
  var closeBtn = document.getElementById("closeWelcomeTabBtn");
  var acknowledged = false;

  function showSuccessState() {
    if (successState) {
      successState.style.display = "flex";
    }
  }

  function presentGreeting() {
    if (typeof showGreetingModal !== "function") return;
    showGreetingModal({
      onDismiss: function () {
        acknowledged = true;
        showSuccessState();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      try {
        window.close();
      } catch {
        window.location.href = "https://www.google.com";
      }
    });
  }

  // The greeting may already have been acknowledged elsewhere; if so, go
  // straight to the success state instead of asking a second time.
  if (typeof hasGreetingCompleted === "function") {
    hasGreetingCompleted().then(function (done) {
      if (done) {
        acknowledged = true;
        showSuccessState();
        return;
      }
      presentGreeting();
    });
  } else {
    presentGreeting();
  }

  // Closing the tab without acknowledging the greeting must not leave the
  // one-shot presentation latched: the in-page path has to remain able to
  // deliver the greeting on the next page the user visits.
  window.addEventListener("pagehide", function () {
    if (acknowledged) return;
    if (typeof markGreetingNotPresented === "function") {
      markGreetingNotPresented();
    }
  });
});
