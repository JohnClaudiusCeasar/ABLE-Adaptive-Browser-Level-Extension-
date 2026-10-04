# Privacy Policy — ABLE: Adaptive Browser-Level Extension

**Effective date:** October 1, 2026
**Contact:** bacarro.johnclaude@gmail.com

This privacy policy describes how the ABLE browser extension ("the Extension") collects, uses, and protects information.

ABLE is a privately operated, research-oriented security tool. Its purpose is to study and demonstrate two browser-security problems: (1) how websites can be classified as safe, unsafe, or unlisted to warn users before they interact with risky domains, and (2) how accidental disclosure of sensitive data (PII, credentials, API keys) through file uploads and text submissions can be detected and prevented before content leaves the browser. The Extension is developed and maintained by an independent researcher ("I", "me", "the operator") as a private research project.

Data described in this policy is transmitted exclusively to the project's own self-hosted research server. I do not sell, share, or monetize any collected data, and I do not use it for advertising, profiling, or any purpose unrelated to this research.

---

## 1. Summary of Data Practices

- **Research project, not a commercial service.** The Extension is a private security-research tool. Data is used only to evaluate and improve website-safety classification and sensitive-data-leakage detection.
- **No third-party data sharing.** All data goes only to the project's first-party research server over HTTPS.
- **No advertising, tracking, or analytics.** The Extension contains no advertising SDKs, third-party analytics, or cross-site tracking.
- **No remote code.** All code is bundled in the Extension package. Server responses are configuration and detection data only, never executed as code.
- **No cookies or credentials.** Network requests omit cookies and credentials entirely (`credentials: "omit"`), and requests are restricted to an allowlisted server origin with TLS certificate pinning.

---

## 2. Information the Extension Collects

### 2.1 Website visit events (research telemetry)
For each top-frame website visited, the Extension records:
- Domain name (hostname) of the visited site
- Safety classification result (safe / unsafe / unlisted)
- Timestamp and a unique event ID
- A locally generated pseudonymous identifier (see Section 4)

Search-result pages and configured excluded domains are not logged. Page contents are not recorded as part of visit logging. This event stream is used to evaluate how well the classification system performs across real browsing contexts.

### 2.2 Content submitted for sensitive-data scanning
When you upload a file or submit text on a website (for example, into an AI chat platform), the Extension sends the following to the research server for security scanning **before** the content leaves your browser:
- Extracted text of the file (up to 200,000 characters) or the submitted text (up to 50,000 characters)
- File metadata: file name, size, extension, and detected format
- A SHA-256 hash of the file contents
- Page context (page URL and page metadata signals such as title, headings, and a short page excerpt) used to improve detection accuracy

The scan result (risk score and categories of sensitive content detected, such as PII, credentials, or API keys) is returned to your browser so the Extension can warn, hold, or block the submission based on your decision. Submitted content is used to compute the scan verdict and to evaluate and improve detection accuracy — for example, by measuring false-positive and false-negative rates.

### 2.3 Egress events (research record of outbound-data decisions)
When you proceed with or cancel a flagged upload or text submission, the Extension logs:
- Domain, timestamp, unique event ID
- File name, file size, and content hash (file **contents are not included** in this record)
- Risk score, detected sensitive-content categories and counts
- Your action (proceeded, cancelled, blocked, or typing cancelled)
- Scan duration and a scan token linking the event to its scan

These events are used to study how users respond to warnings and to measure the effectiveness of the interception system.

### 2.4 Page metadata signals for site classification
To classify a website as safe, unsafe, or unlisted, the Extension sends the page URL and limited page metadata (title, meta tags, headings, a short body excerpt up to ~3,000 characters, form flags, and image alt text) to the research server. Classification results are cached locally (in signed, tamper-evident form) so the Extension works offline. These signals are used as research inputs for improving classification accuracy.

### 2.5 Extension lifecycle events
Installation, update, and uninstall events are reported with the pseudonymous identifier, extension ID, and extension version, to understand deployment status and diagnose problems.

### 2.6 Information I do NOT collect
- No browsing history beyond the domain-level events described above
- No keystrokes or form contents other than text you are actively submitting externally (which is scanned as described in 2.2)
- No personal identity, account credentials, email address, or device fingerprint
- No data from analytics/telemetry endpoints of websites (these are explicitly excluded from interception)

---

## 3. How Information Is Used

Collected information is used solely for:
1. **Security research** — studying website-safety classification and sensitive-data-leakage prevention in the browser
2. **Detection evaluation** — measuring the accuracy of sensitive-content detection (risk scores, false positives/negatives) and warning effectiveness
3. **Operation of the tool** — providing real-time warnings, holds, and blocks while you browse
4. **Improving the Extension** — diagnosing problems and refining detection patterns and classification behavior

I do not use collected data for marketing, advertising, user profiling, monetization, or any purpose unrelated to this research. Research results are published only in aggregate or anonymized form (for example, detection accuracy statistics) — raw event data, file names, and submitted content are not published or shared.

---

## 4. Pseudonymous Identifier

The Extension generates a random identifier locally in your browser (format `ABLE-XXXXXXXX`). It is:
- Randomly generated on your device; it is not derived from any personal information
- Used only to correlate events for research analysis (for example, measuring repeat-warning behavior) and to maintain extension state
- Not linked to any account, name, email, or hardware identifier
- Never combined with identity data, and never used to track you across sites for any purpose outside this research

---

## 5. Data Security

- All traffic uses HTTPS to the research server, with TLS certificate pinning (SPKI pin) and an origin allowlist
- Redirects are refused; requests never carry cookies or credentials
- Server responses containing policies and detection patterns are HMAC-SHA-256 signed and verified locally; tampered caches are purged
- The research server is access-controlled and operated solely by the researcher; collected data is not made publicly available
- Offline operation: when the server is unreachable, events are queued locally and uploaded when connectivity returns; unscored uploads are held rather than sent

---

## 6. Data Sharing and Disclosure

- **No sale, rental, or sharing with third parties.** Data is transmitted only to the project's research server.
- **No third-party processors** receive data from the Extension.
- Research findings are shared only in aggregate or anonymized form (e.g., detection-rate statistics, pattern-performance analysis).
- I may disclose information only if required by law or in connection with a valid legal process.

---

## 7. Data Retention

- Locally cached policies, detection patterns, and consent state persist until replaced by a sync or until the Extension is uninstalled
- Queued events awaiting upload are deleted once successfully delivered
- Server-side research data (visit events, egress events, scan inputs) is kept while the research project is active — [insert retention period, e.g. "12 months"] — after which it is deleted or aggregated into anonymized statistics
- Uninstalling the Extension removes all locally stored data from your browser; server-side records follow the retention policy above

---

## 8. Children's Privacy

The Extension is a security-research tool intended for technically informed adult users. It is not directed at children, and I do not knowingly collect information from children.

---

## 9. Your Rights and Choices

- You may decline to proceed after a warning (cancelling an upload or send); the Extension never sends content externally without your action
- You may uninstall the Extension at any time; this stops all data collection immediately
- You may contact me to request access to, correction of, or deletion of the data associated with your pseudonymous identifier, and I will honor such requests to the extent technically and legally possible
- Participation is voluntary; if you do not agree with this policy, please do not use the Extension

---

## 10. Changes to This Policy

I may update this policy to reflect changes in the Extension's behavior or legal requirements. Material changes will be posted on this page with a revised effective date. Continued use of the Extension after changes constitutes acceptance of the updated policy.

---

## 11. Contact

For questions about this policy or the Extension's data practices, or to exercise your data rights:

- **Operator:** John Claude Bacarro
- **Email:** bacarro.johnclaude@gmail.com
