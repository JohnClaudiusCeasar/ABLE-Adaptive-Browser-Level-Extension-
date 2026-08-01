const COMPANY_NAME = "ABLE";

/**
 * Generate status messages for domain classification.
 * These are template messages, not data - they use the classification result from the server/cache.
 */
function getStatusMessage(status, domain, category, alternatives) {
  const messages = {
    safe: {
      title: "The site you are entering is SAFE",
      message: `${domain} has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared safe to use and operate.\n\nFeel free to use the website to your heart\u2019s content,\n\nHave a nice day :)`,
      suggestion: ""
    },
    unsafe: {
      title: "The site you are entering is UNSAFE",
      message: `${domain} has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared to be unsafe to use.\nPlease refrain from sending sensitive institutional data to this website.${category && alternatives.length ? `\n\nSince you are entering a ${category} website, to make your internet experience safe, please consider the following alternatives: ${alternatives.join(", ")}.` : ""}`,
      suggestion: ""
    },
    unlisted: {
      title: "The site you are entering is UNLISTED",
      message: `${domain} is an unlisted service that has not been reviewed, and analyzed by the ${COMPANY_NAME} IT security department. While the service is not labeled unsafe by our security team, please refrain from sending any sensitive institutional data from this website until it is properly reviewed.`,
      suggestion: ""
    }
  };

  return messages[status] || messages.unlisted;
}

/**
 * Generate a default unlisted response when no classification data is available.
 */
function getDefaultClassification(domain) {
  return {
    status: "unlisted",
    domain: domain,
    category: null,
    alternatives: [],
    policy: "under_review",
    risk_score: 0,
  };
}
