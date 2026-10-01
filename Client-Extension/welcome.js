/**
 * ABLE Extension - Welcome Page Script
 *
 * Controls display of the greeting modal on the onboarding tab
 * and handles post-acknowledgment state.
 */

document.addEventListener("DOMContentLoaded", function () {
  var successState = document.getElementById("welcomeSuccessState");
  var closeBtn = document.getElementById("closeWelcomeTabBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      try {
        window.close();
      } catch {
        window.location.href = "https://www.google.com";
      }
    });
  }

  // Display the greeting modal immediately on load
  if (typeof showGreetingModal === "function") {
    showGreetingModal({
      onDismiss: function () {
        if (successState) {
          successState.style.display = "flex";
        }
      }
    });
  }
});
