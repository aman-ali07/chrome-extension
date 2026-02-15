/**
 * Content script.
 * Runs in the context of web pages; use for reading/modifying the DOM.
 */

(function () {
  'use strict';

  /**
   * URL patterns for coding platform problem pages.
   */
  const URL_PATTERNS = {
    leetcode: [
      /^https?:\/\/(www\.)?leetcode\.com\/problems\/[^/]+\/?(\?.*)?$/,
    ],
    codeforces: [
      /^https?:\/\/(www\.)?codeforces\.com\/problemset\/problem\/\d+\/[A-Za-z0-9]+(\?.*)?$/,
      /^https?:\/\/(www\.)?codeforces\.com\/contest\/\d+\/problem\/[A-Za-z0-9]+(\?.*)?$/,
      /^https?:\/\/(www\.)?codeforces\.com\/problemset\/status(\/.*)?(\?.*)?$/,
      /^https?:\/\/(www\.)?codeforces\.com\/contest\/\d+\/status(\?.*)?$/,
    ],
    gfg: [
      /^https?:\/\/(www\.)?geeksforgeeks\.org\/problems\/[^/]+\/\d+(\?.*)?$/,
      /^https?:\/\/practice\.geeksforgeeks\.org\/problems\/[^/]+\/\d+(\?.*)?$/,
    ],
  };

  /**
   * URL patterns for pages where submission results appear (Codeforces redirects here).
   */
  const SUBMISSION_PAGE_PATTERNS = {
    codeforces: [
      /^https?:\/\/(www\.)?codeforces\.com\/problemset\/status(\/.*)?(\?.*)?$/,
      /^https?:\/\/(www\.)?codeforces\.com\/contest\/\d+\/status(\?.*)?$/,
    ],
  };

  /**
   * DOM selectors that indicate a problem page (not a listing).
   * Empty array = rely on URL only.
   */
  const DOM_MARKERS = {
    leetcode: ['[data-cy="question-title"]', '.question-content', '[data-key="description"]'],
    codeforces: ['.problem-statement', '.problemindexholder', '#pageContent'],
    gfg: [], // GFG DOM structure varies; URL pattern is primary
  };

  /**
   * Checks if any URL pattern matches the given URL.
   * @param {string} url
   * @param {RegExp[]} patterns
   * @returns {boolean}
   */
  function urlMatches(url, patterns) {
    return patterns.some((pattern) => pattern.test(url));
  }

  /**
   * Checks if any DOM marker exists on the page.
   * @param {string[]} selectors
   * @returns {boolean}
   */
  function domMatches(selectors) {
    return selectors.some((sel) => {
      try {
        return document.querySelector(sel) !== null;
      } catch {
        return false;
    }
    });
  }

  /**
   * Detects the coding platform and whether the current page is a problem page
   * or a page where submission results appear.
   *
   * @returns {{ platform: "leetcode" | "codeforces" | "gfg" | null, problemPage: boolean, submissionPage: boolean }}
   */
  function detectPlatform() {
    const url = window.location.href;
    const result = { platform: null, problemPage: false, submissionPage: false };

    for (const [platform, patterns] of Object.entries(URL_PATTERNS)) {
      if (!urlMatches(url, patterns)) continue;

      const markers = DOM_MARKERS[platform];
      const submissionPatterns = SUBMISSION_PAGE_PATTERNS[platform];
      const hasDomMarker =
        !markers || markers.length === 0 ? true : domMatches(markers);
      const isSubmissionPage =
        submissionPatterns?.some((p) => p.test(url)) ?? false;

      result.platform = platform;
      result.problemPage = hasDomMarker;
      result.submissionPage = isSubmissionPage || hasDomMarker;
      break;
    }

    return result;
  }

  /**
   * Platform-specific metadata extractors.
   */
  const EXTRACTORS = {
    leetcode() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'leetcode' };
      meta.url = window.location.href;

      const titleEl = document.querySelector('[data-cy="question-title"]');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) {
        const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (slugMatch) meta.title = slugMatch[1].replace(/-/g, ' ');
      }

      const diffEl = document.querySelector('[class*="text-difficulty-"]');
      if (diffEl) {
        const cls = diffEl.className ?? '';
        const match = cls.match(/text-difficulty-(easy|medium|hard)/i);
        meta.difficulty = match ? match[1].toLowerCase() : diffEl.textContent?.trim()?.toLowerCase() ?? null;
      }

      const tagEls = document.querySelectorAll('[data-cy="question-topic-tag"], a[href*="/tag/"]');
      tagEls.forEach((el) => {
        const tag = el.textContent?.trim();
        if (tag && !meta.tags.includes(tag)) meta.tags.push(tag);
      });

      return meta;
    },

    codeforces() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'codeforces' };
      meta.url = window.location.href;

      const titleEl = document.querySelector('.problem-statement .title');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) meta.title = document.title?.replace(/\s*-\s*Codeforces$/, '') ?? null;

      const roundbox = document.querySelector('.roundbox');
      if (roundbox) {
        const ratingMatch = roundbox.textContent?.match(/\*(\d+)/);
        if (ratingMatch) meta.difficulty = ratingMatch[1];

        const tagLinks = roundbox.querySelectorAll('a[href*="/problemset?tags="], .tag-box');
        tagLinks.forEach((el) => {
          const tag = el.textContent?.trim();
          if (tag && !tag.startsWith('*') && !meta.tags.includes(tag)) meta.tags.push(tag);
        });
      }

      return meta;
    },

    gfg() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'gfg' };
      meta.url = window.location.href;

      const titleEl =
        document.querySelector('h1, .problem-statement h1, [class*="problemHeader"]');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) {
        const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (slugMatch) meta.title = slugMatch[1].replace(/-/g, ' ');
      }

      const diffEl =
        document.querySelector('[class*="difficulty"], .badge, [class*="Easy"], [class*="Medium"], [class*="Hard"]');
      if (diffEl) {
        const text = diffEl.textContent?.trim() ?? '';
        if (/easy/i.test(text)) meta.difficulty = 'easy';
        else if (/medium/i.test(text)) meta.difficulty = 'medium';
        else if (/hard/i.test(text)) meta.difficulty = 'hard';
      }

      const tagEls = document.querySelectorAll('a[href*="/tag/"], [class*="tag"]');
      tagEls.forEach((el) => {
        const tag = el.textContent?.trim();
        if (tag && tag.length < 50 && !meta.tags.includes(tag)) meta.tags.push(tag);
      });

      return meta;
    },
  };

  /**
   * Extracts problem metadata when on a supported problem page.
   * Returns structured JSON. Handles platform differences.
   *
   * @returns {{ title: string|null, difficulty: string|null, tags: string[], url: string|null, platform: string|null }}
   */
  function extractProblemMetadata() {
    const { platform, problemPage } = detectPlatform();

    const empty = {
      title: null,
      difficulty: null,
      tags: [],
      url: null,
      platform: null,
    };

    if (!platform || !problemPage) return empty;

    const extractor = EXTRACTORS[platform];
    if (!extractor) return { ...empty, platform };

    try {
      const meta = extractor();
      return meta;
    } catch (err) {
      console.warn('extractProblemMetadata failed:', err);
      return { ...empty, platform, url: window.location.href };
    }
  }

  /**
   * Platform-specific success detection. Returns true if the node tree contains
   * a successful submission indicator.
   */
  const SUCCESS_DETECTORS = {
    leetcode(node) {
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (!el) return false;
      const fullText = (el.textContent ?? '');
      if (/\d[\d,]*\s*Accepted\s*\/\s*[\d.]/.test(fullText)) return false;
      const resultEl = el.closest?.('[data-e2e-locator="console-result"], [class*="result-success"], [class*="submission-result"]');
      if (resultEl?.textContent?.includes('Accepted')) return true;
      return (el.textContent?.trim() ?? '') === 'Accepted';
    },
    codeforces(node) {
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (!el) return false;
      const verdictEl = el.closest?.('.verdict-accepted, .verdict-ok') ?? el.querySelector?.('.verdict-accepted, .verdict-ok');
      if (verdictEl) return true;
      const text = (node.textContent ?? '').trim();
      return text === 'Accepted' || text === 'OK';
    },
    gfg(node) {
      const text = (node.textContent ?? '').trim().toLowerCase();
      return (
        text.includes('all test cases passed') ||
        text.includes('success') ||
        text === 'correct'
      );
    },
  };

  /**
   * Verdict patterns that indicate any submission (success or fail).
   */
  const ATTEMPT_PATTERNS = {
    leetcode: [
      'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error',
      'Compilation Error', 'Memory Limit Exceeded', 'Output Limit Exceeded',
    ],
    codeforces: [
      'Accepted', 'OK', 'Wrong answer', 'Time limit exceeded', 'Runtime error',
      'Memory limit exceeded', 'Compilation error', 'Hacked', 'Partial',
    ],
    gfg: [
      'All test cases passed', 'Success', 'Correct', 'Wrong Answer',
      'Time Limit Exceeded', 'Runtime Error',
    ],
  };

  function isAttemptText(text, platform) {
    const patterns = ATTEMPT_PATTERNS[platform];
    if (!patterns) return false;
    const t = (text ?? '').trim();
    return patterns.some((p) => t === p || t.includes(p));
  }

  /**
   * Checks if any added node indicates a submission result (any verdict).
   */
  function checkNodesForAttempt(nodes, platform) {
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      const el = node;
      if (platform === 'codeforces') {
        const verdictEl = el.closest?.('[class*="verdict-"]') ?? el.querySelector?.('[class*="verdict-"]');
        if (verdictEl) return true;
      }
      const text = (el.textContent ?? '').trim();
      if (isAttemptText(text, platform)) {
        if (platform === 'leetcode' && /\d[\d,]*\s*Accepted\s*\/\s*[\d.]/.test(text)) continue;
        return true;
      }
      const children = el.querySelectorAll?.('*') ?? [];
      for (const child of children) {
        if (platform === 'codeforces' && child.closest?.('[class*="verdict-"]')) return true;
        if (isAttemptText(child.textContent, platform)) {
          if (platform === 'leetcode' && /\d[\d,]*\s*Accepted\s*\/\s*[\d.]/.test(child.textContent ?? '')) continue;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Checks if any added node indicates a successful solve for the current platform.
   */
  function checkNodesForSuccess(nodes, platform) {
    const detector = SUCCESS_DETECTORS[platform];
    if (!detector) return false;

    for (const node of nodes) {
      if (node.nodeType === 1 && detector(node)) return true;
      if (node.nodeType === 3) {
        const text = (node.textContent ?? '').trim();
        const parentText = node.parentElement?.textContent ?? '';
        if (platform === 'leetcode' && text === 'Accepted' && !/\d[\d,]*\s*Accepted\s*\/\s*[\d.]/.test(parentText)) return true;
        if (platform === 'codeforces' && (text === 'Accepted' || text === 'OK')) return true;
        if (platform === 'gfg' && /all test cases passed|success|^correct$/i.test(text)) return true;
      }
      if (node.nodeType === 1) {
        for (const child of node.querySelectorAll?.('*') ?? []) {
          if (detector(child)) return true;
        }
      }
    }
    return false;
  }

  const SOLVE_COOLDOWN_MS = 3000;
  const ATTEMPT_COOLDOWN_MS = 1500;
  const OBSERVER_START_DELAY_MS = 1500;

  let lastSolveEmit = 0;
  let lastAttemptEmit = 0;
  let solveStartTime = null;
  let submissionAttempts = 0;

  /**
   * Starts the solve timer. Called once when page loads. Never resets on DOM changes.
   */
  function startSolveTimer() {
    if (solveStartTime === null) {
      solveStartTime = Date.now();
    }
  }

  /**
   * Returns solve tracking stats.
   */
  function getSolveStats() {
    const elapsed = solveStartTime !== null ? Math.round((Date.now() - solveStartTime) / 1000) : 0;
    return {
      timeSpent: elapsed,
      attempts: submissionAttempts,
    };
  }

  /**
   * Emits solve detection with tracking stats. Logs and returns the payload.
   */
  function emitSolveDetected() {
    const stats = getSolveStats();
    const payload = { solved: true, timestamp: Date.now(), ...stats };
    console.log('Solve detected:', payload);
    return payload;
  }

  /**
   * Starts observing the DOM for submission indicators and successful solves.
   */
  function startSubmissionObserver() {
    const { platform, submissionPage } = detectPlatform();
    if (!platform || !submissionPage) return;

    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      const addedNodes = [];
      for (const m of mutations) {
        if (m.addedNodes.length > 0) addedNodes.push(...Array.from(m.addedNodes));
      }
      if (addedNodes.length === 0) return;

      const attemptDetected = checkNodesForAttempt(addedNodes, platform);
      if (attemptDetected && now - lastAttemptEmit >= ATTEMPT_COOLDOWN_MS) {
        lastAttemptEmit = now;
        submissionAttempts += 1;
      }

      if (now - lastSolveEmit < SOLVE_COOLDOWN_MS) return;

      if (checkNodesForSuccess(addedNodes, platform)) {
        if (!attemptDetected || now - lastAttemptEmit >= ATTEMPT_COOLDOWN_MS) {
          submissionAttempts += 1;
        }
        lastSolveEmit = now;
        emitSolveDetected();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  const detection = detectPlatform();
  console.log('Content script loaded on', window.location.href);
  console.log('Platform detection:', detection);

  if (detection.problemPage && detection.platform) {
    const metadata = extractProblemMetadata();
    console.log('Extracted problem metadata:', metadata);
  }
  if (detection.submissionPage && detection.platform) {
    startSolveTimer();
    setTimeout(startSubmissionObserver, OBSERVER_START_DELAY_MS);
  }
})();
