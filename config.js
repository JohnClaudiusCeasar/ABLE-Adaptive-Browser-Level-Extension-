/**
 * ABLE Extension - Domain Safety Configuration
 * Hard-coded rulesets for domain classification
 * Easy to update and maintain
 */

const DOMAIN_CONFIG = {
  // SAFE DOMAINS - Trusted, verified safe websites
  safe: {
    domains: [
      // Government & Official
      "google.com",
      "microsoft.com",
      "apple.com",
      "github.com",
      "stackoverflow.com",
      "wikipedia.org",
      "bbc.com",
      "wikipedia.org",
      "khan-academy.org",
      "britannica.com",
      
      // Major Tech Companies
      "facebook.com",
      "meta.com",
      "twitter.com",
      "linkedin.com",
      "reddit.com",
      "medium.com",
      "youtube.com",
      "vimeo.com",
      "twitch.tv",
      
      // Banking & Finance (Major Institutions)
      "paypal.com",
      "stripe.com",
      "coinbase.com",
      
      // Email Services
      "gmail.com",
      "outlook.com",
      "protonmail.com",
      "tutanota.com",
      
      // Shopping
      "amazon.com",
      "ebay.com",
      "etsy.com",
      
      // Streaming
      "netflix.com",
      "spotify.com",
      "disneyplus.com",
      
      // News & Media
      "cnn.com",
      "bbc.co.uk",
      "reuters.com",
      "apnews.com",
      "theguardian.com",
      
      // Security Tools
      "virustotal.com",
      "malwarebytes.com",
      "kaspersky.com",
      "mcafee.com",
      
      // Educational
      "coursera.org",
      "edx.org",
      "udemy.com",
      "duolingo.com",
      
      // Development
      "npm.org",
      "npmjs.com",
      "pypi.org",
      "crates.io",
      "rubygems.org",
      "maven.apache.org",
      "docker.com",
      "aws.amazon.com",
      "azure.microsoft.com",
      "cloud.google.com"
    ],
    
    // Pattern matching for safe domains
    patterns: [
      /^([\w-]+\.)*\.(edu|gov|org)$/i,  // Educational, government, nonprofit
      /^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i,  // Government domains worldwide
      /^(www\.)?github\.com\/.+/i,  // GitHub repositories
      /^(www\.)?youtube\.com\/.+/i   // YouTube videos
    ]
  },

  // UNSAFE DOMAINS - Known malicious, phishing, malware sites
  unsafe: {
    domains: [
      // Known Phishing
      "paypa1.com",
      "amaz0n.com",
      "goog1e.com",
      "micr0soft.com",
      
      // Known Malware Distribution
      "malicious-site.xyz",
      "phishing-bank.com",
      "fake-login.net",
      "credential-stealer.io",
      
      // Ransomware & Exploit Sites
      "ransomware-as-service.net",
      "exploit-kit.ru",
      
      // Scam Sites
      "nigerian-prince-fortune.com",
      "claim-your-prize.net",
      "you-won-lottery.xyz",
      "urgent-account-verify.net",
      
      // Darknet & Illegal Markets (demonstrative examples)
      "illegal-marketplace.onion",
      "stolen-data-sales.net"
    ],
    
    // Pattern matching for unsafe indicators
    patterns: [
      /^([\w-]*phish[\w-]*\.)+\w+$/i,  // Domain containing "phish"
      /^([\w-]*malware[\w-]*\.)+\w+$/i,  // Domain containing "malware"
      /^([\w-]*exploit[\w-]*\.)+\w+$/i,  // Domain containing "exploit"
      /^([\w-]*ransomware[\w-]*\.)+\w+$/i,  // Domain containing "ransomware"
      /^([\w-]*scam[\w-]*\.)+\w+$/i,  // Domain containing "scam"
      /^([\w-]*fake[\w-]*\.)+\w+$/i,  // Domain containing "fake"
      /^([\w-]*trojan[\w-]*\.)+\w+$/i,  // Domain containing "trojan"
      /^([\w-]*virus[\w-]*\.)+\w+$/i,  // Domain containing "virus"
      /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\./  // Private/local IPs
    ]
  },

  // UNLISTED DOMAINS - Not in safe or unsafe lists (unknown/unverified)
  unlisted: {
    message: "This domain has not been reviewed and verified by ABLE. Exercise caution when entering sensitive information.",
    suggestion: "Consider using verified alternative services when available."
  }
};

/**
 * Classify a domain based on the rulesets
 * @param {string} url - The full URL or domain to check
 * @returns {Object} - { status: 'safe'|'unsafe'|'unlisted', domain: string }
 */
function classifyDomain(url) {
  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, ""); // Remove www prefix for matching

    // Check UNSAFE first (most critical)
    if (isInList(domain, DOMAIN_CONFIG.unsafe.domains) || 
        matchesPatterns(domain, DOMAIN_CONFIG.unsafe.patterns)) {
      return {
        status: "unsafe",
        domain: domain,
        reason: "This domain is known to be unsafe or malicious"
      };
    }

    // Check SAFE
    if (isInList(domain, DOMAIN_CONFIG.safe.domains) || 
        matchesPatterns(domain, DOMAIN_CONFIG.safe.patterns)) {
      return {
        status: "safe",
        domain: domain,
        reason: "This domain has been verified as safe"
      };
    }

    // Default to UNLISTED
    return {
      status: "unlisted",
      domain: domain,
      reason: "This domain has not been reviewed and verified"
    };
  } catch (error) {
    console.error("Error classifying domain:", error);
    return {
      status: "unlisted",
      domain: "unknown",
      reason: "Error analyzing domain"
    };
  }
}

/**
 * Check if domain is in the provided list
 * @param {string} domain - Domain to check
 * @param {Array} list - List of domains to match against
 * @returns {boolean}
 */
function isInList(domain, list) {
  return list.some(item => {
    // Exact match
    if (domain === item) return true;
    // Subdomain match (e.g., mail.google.com matches google.com)
    if (domain.endsWith("." + item)) return true;
    return false;
  });
}

/**
 * Check if domain matches any pattern in the provided list
 * @param {string} domain - Domain to check
 * @param {Array} patterns - Array of regex patterns to match against
 * @returns {boolean}
 */
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

/**
 * Get detailed message for a status
 * @param {string} status - The domain status
 * @returns {Object} - { title, message, suggestion }
 */
function getStatusMessage(status) {
  const messages = {
    safe: {
      title: "The site you are entering is SAFE",
      message: "This domain has been reviewed and verified by the ABLE security team. It is a trusted and secure website.",
      suggestion: "Feel free to use the website to share your sensitive information."
    },
    unsafe: {
      title: "The site you are entering is UNSAFE",
      message: "This domain has been identified as malicious, phishing, or potentially harmful. It may attempt to steal your credentials or infect your device with malware.",
      suggestion: "Please refrain from accessing sensitive institutional data to this website. To improve your browser experience, we recommend using one of the suggested secure alternatives."
    },
    unlisted: {
      title: "The site you are entering is UNLISTED",
      message: "This domain is an unknown service and has not been reviewed or evaluated by the ABLE security team yet. While it may be safe, we cannot confirm its legitimacy.",
      suggestion: "We recommend exploring alternative services that have been verified. If you must proceed, do not share sensitive personal or financial information."
    }
  };

  return messages[status] || messages.unlisted;
}
