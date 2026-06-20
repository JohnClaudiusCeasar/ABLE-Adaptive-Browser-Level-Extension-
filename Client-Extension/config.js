const COMPANY_NAME = "ABLE";

const WEBSITE_ALTERNATIVES = {
  "Government & Official": { label: "government & official", alternatives: [] },
  "Major Tech Companies": { label: "major tech", alternatives: [] },
  "Banking & Finance": { label: "banking & finance", alternatives: ["PayPal", "Stripe"] },
  "Email Services": { label: "email", alternatives: ["Gmail", "Outlook"] },
  "Shopping": { label: "shopping", alternatives: ["Amazon", "eBay"] },
  "Streaming": { label: "streaming", alternatives: ["Netflix", "Spotify"] },
  "News & Media": { label: "news & media", alternatives: ["CNN", "Reuters"] },
  "Security Tools": { label: "security", alternatives: ["VirusTotal", "Malwarebytes"] },
  "Educational": { label: "educational", alternatives: ["Coursera", "edX"] },
  "Development": { label: "development", alternatives: ["GitHub", "AWS"] },
  "Phishing Attempts": { label: "phishing", alternatives: [] },
  "Malware Distribution": { label: "malware", alternatives: [] },
  "Ransomware & Exploits": { label: "ransomware", alternatives: [] },
  "Scam Sites": { label: "scam", alternatives: [] },
  "Illegal Markets": { label: "illegal market", alternatives: [] }
};

const DOMAIN_CONFIG = {
  safe: {
    categories: {
      "Government & Official": [
        "google.com", "microsoft.com", "apple.com", "github.com", "stackoverflow.com",
        "wikipedia.org", "bbc.com", "khan-academy.org", "britannica.com"
      ],
      "Major Tech Companies": [
        "facebook.com", "meta.com", "twitter.com", "linkedin.com", "reddit.com",
        "medium.com", "youtube.com", "vimeo.com", "twitch.tv"
      ],
      "Banking & Finance": [
        "paypal.com", "stripe.com", "coinbase.com"
      ],
      "Email Services": [
        "gmail.com", "outlook.com", "protonmail.com", "tutanota.com"
      ],
      "Shopping": [
        "amazon.com", "ebay.com", "etsy.com"
      ],
      "Streaming": [
        "netflix.com", "spotify.com", "disneyplus.com"
      ],
      "News & Media": [
        "cnn.com", "bbc.co.uk", "reuters.com", "apnews.com", "theguardian.com"
      ],
      "Security Tools": [
        "virustotal.com", "malwarebytes.com", "kaspersky.com", "mcafee.com"
      ],
      "Educational": [
        "coursera.org", "edx.org", "udemy.com", "duolingo.com"
      ],
      "Development": [
        "npm.org", "npmjs.com", "pypi.org", "crates.io", "rubygems.org",
        "maven.apache.org", "docker.com", "aws.amazon.com", "azure.microsoft.com", "cloud.google.com"
      ]
    },
    patterns: [
      /^([\w-]+\.)*\.(edu|gov|org)$/i,
      /^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i,
      /^(www\.)?github\.com\/.+/i,
      /^(www\.)?youtube\.com\/.+/i
    ]
  },

  unsafe: {
    categories: {
      "Phishing Attempts": [
        "paypa1.com", "amaz0n.com", "goog1e.com", "micr0soft.com"
      ],
      "Malware Distribution": [
        "malicious-site.xyz", "phishing-bank.com", "fake-login.net", "credential-stealer.io"
      ],
      "Ransomware & Exploits": [
        "ransomware-as-service.net", "exploit-kit.ru"
      ],
      "Scam Sites": [
        "nigerian-prince-fortune.com", "claim-your-prize.net",
        "you-won-lottery.xyz", "urgent-account-verify.net"
      ],
      "Illegal Markets": [
        "illegal-marketplace.onion", "stolen-data-sales.net"
      ]
    },
    patterns: [
      /^([\w-]*phish[\w-]*\.)+\w+$/i,
      /^([\w-]*malware[\w-]*\.)+\w+$/i,
      /^([\w-]*exploit[\w-]*\.)+\w+$/i,
      /^([\w-]*ransomware[\w-]*\.)+\w+$/i,
      /^([\w-]*scam[\w-]*\.)+\w+$/i,
      /^([\w-]*fake[\w-]*\.)+\w+$/i,
      /^([\w-]*trojan[\w-]*\.)+\w+$/i,
      /^([\w-]*virus[\w-]*\.)+\w+$/i,
      /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\./
    ]
  },

  unlisted: {
    message: "This domain has not been reviewed and verified by ABLE. Exercise caution when entering sensitive information.",
    suggestion: "Consider using verified alternative services when available."
  }
};

function isInList(domain, list) {
  return list.some(item => {
    if (domain === item) return true;
    if (domain.endsWith("." + item)) return true;
    return false;
  });
}

function matchesPatterns(domain, patterns) {
  return patterns.some(pattern => {
    try {
      return pattern.test(domain);
    } catch (error) {
      console.error("Error matching pattern:", error);
      return false;
    }
  });
}

function classifyDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    for (const [categoryName, domains] of Object.entries(DOMAIN_CONFIG.unsafe.categories)) {
      if (isInList(domain, domains)) {
        const info = WEBSITE_ALTERNATIVES[categoryName];
        return {
          status: "unsafe",
          domain: domain,
          category: info ? info.label : null,
          alternatives: info ? info.alternatives : []
        };
      }
    }

    if (matchesPatterns(domain, DOMAIN_CONFIG.unsafe.patterns)) {
      return {
        status: "unsafe",
        domain: domain,
        category: null,
        alternatives: []
      };
    }

    for (const [categoryName, domains] of Object.entries(DOMAIN_CONFIG.safe.categories)) {
      if (isInList(domain, domains)) {
        const info = WEBSITE_ALTERNATIVES[categoryName];
        return {
          status: "safe",
          domain: domain,
          category: info ? info.label : null,
          alternatives: info ? info.alternatives : []
        };
      }
    }

    if (matchesPatterns(domain, DOMAIN_CONFIG.safe.patterns)) {
      return {
        status: "safe",
        domain: domain,
        category: null,
        alternatives: []
      };
    }

    return {
      status: "unlisted",
      domain: domain,
      category: null,
      alternatives: []
    };
  } catch (error) {
    console.error("Error classifying domain:", error);
    return {
      status: "unlisted",
      domain: "unknown",
      category: null,
      alternatives: []
    };
  }
}

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
