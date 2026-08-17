/*
  study-guide-maker shared script
  Master copy: C:\vc\config\claude\skills\study-guide-maker\assets\script.js
  Deployed copy (what guides actually link to): C:\vc\workshop\study-guides\assets\script.js
  Vanilla JS, no dependencies, no network calls — every guide must open standalone via file://.
*/
(function () {
  "use strict";

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  // Heading text for nav/slug purposes, excluding decorative inline elements (level badges
  // etc.) that live inside the heading for in-page display but shouldn't leak into the TOC
  // label or the auto-generated anchor id.
  function headingLabel(h) {
    var clone = h.cloneNode(true);
    clone.querySelectorAll(".sg-level-badge").forEach(function (el) { el.remove(); });
    return clone.textContent.trim();
  }

  // Sidebar TOC nav text can be a shorter, prefix-free version of the full heading — set via
  // data-toc="..." on the heading (e.g. <h2 data-toc="What Is GIS?">1. What Is GIS?</h2>) when
  // the full heading text (a numeral prefix, an explanatory suffix after a dash/colon) would
  // wrap to 2+ lines in the narrow sidebar. Falls back to the full heading text when data-toc
  // isn't set. Deliberately scoped to the sidebar only — the anchor id/slug (headingLabel, used
  // in buildToc below) and the in-page heading itself always use the full text, so abbreviating
  // the nav label never changes what's shown or linked-to in the actual page content.
  function tocLabel(h) {
    return (h.dataset && h.dataset.toc) ? h.dataset.toc.trim() : headingLabel(h);
  }

  // ---------- Header offset (drives scroll-margin-top and the TOC's sticky top) ----------
  // The sticky header's real height varies per guide (title length/wrap, viewport width) —
  // never hardcode a pixel guess for it. Measure the actual rendered height and publish it as
  // a CSS var everything else reads from, so jumping to a heading (TOC click, browser
  // back/forward, a direct #anchor link) never lands a heading underneath the sticky bar.
  //
  // The buffer added on top of the header height is .sg-main's own measured top padding, not a
  // separate hardcoded guess (that used to be a bare "+ 20", chosen independently of .sg-main's
  // padding-top in style.css — the two numbers had no reason to agree, so a TOC-jump to the
  // very first heading landed it at a visibly different distance below the header than simply
  // scrolling to the top of the page). Reading the real padding means both paths always agree:
  // jumping to the first heading now lands scrollY at exactly 0, identical to a manual scroll
  // to the top, and every other heading gets that same breathing room under the sticky header.
  function syncHeaderOffset() {
    var header = document.querySelector(".sg-header");
    var main = document.querySelector(".sg-main");
    if (!header) return;
    function set() {
      var h = header.getBoundingClientRect().height;
      var buffer = main ? parseFloat(getComputedStyle(main).paddingTop) || 20 : 20;
      document.documentElement.style.setProperty("--sg-header-offset", Math.ceil(h + buffer) + "px");
    }
    set();
    window.addEventListener("resize", set);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
  }

  // ---------- Table of contents (auto-built from h2/h3 inside <main>) ----------
  // Targets #toc-nav (inside .sg-toc-body), NOT the outer #toc/.sg-toc element — rebuilding the
  // nav must never wipe the rail buttons or the "Contents" title that live alongside it.
  function buildToc() {
    var main = document.querySelector(".sg-main");
    var tocRoot = document.getElementById("toc-nav");
    if (!main || !tocRoot) return;

    var headings = main.querySelectorAll("h2, h3");
    if (!headings.length) return;

    var usedIds = {};
    var topList = document.createElement("ul");
    var currentSubList = null;

    headings.forEach(function (h) {
      var fullLabel = headingLabel(h);
      var navLabel = tocLabel(h);
      if (!h.id) {
        var base = slugify(fullLabel);
        var id = base;
        var n = 2;
        while (usedIds[id] || document.getElementById(id)) {
          id = base + "-" + n++;
        }
        h.id = id;
      }
      usedIds[h.id] = true;

      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      // Header (H2) vs. subheader (H3) hierarchy is conveyed by typography alone — see
      // ".sg-toc nav > ul > li > a" (bold, larger) vs. ".sg-toc nav ul ul a" (normal, smaller)
      // in style.css — not by prepending a marker element here. A small filled bullet used to
      // be added to every H2 entry; removed 2026-08-07, see style.css's comment on those rules
      // for why (it was also part of what made H2 entries sit more indented than their own H3
      // children).
      a.appendChild(document.createTextNode(navLabel));
      li.appendChild(a);

      if (h.tagName === "H2") {
        topList.appendChild(li);
        currentSubList = document.createElement("ul");
        li.appendChild(currentSubList);
      } else if (currentSubList) {
        currentSubList.appendChild(li);
      } else {
        topList.appendChild(li);
      }
    });

    // Every top-level (H2) entry gets wrapped in the same .sg-toc-row structure — a real,
    // clickable disclosure caret for sections that actually have sub-items, or an equal-width
    // *invisible* spacer for sections that don't — so every H2 label's text starts at the same
    // horizontal position regardless of whether that particular section happens to be
    // collapsible. Before this, a heading with no sub-items skipped the row wrapper entirely and
    // sat flush left where a caret would have been, so labels visibly zig-zagged depending on
    // which sections had children. An empty sublist (an H2 with no following H3s before the next
    // H2) gets dropped rather than left as a dead empty <ul>.
    Array.prototype.forEach.call(topList.children, function (li) {
      var sub = li.querySelector(":scope > ul");
      var topAnchor = li.querySelector(":scope > a");
      var hasSub = !!(sub && sub.children.length);
      if (sub && !hasSub) sub.remove();

      var row = document.createElement("div");
      row.className = "sg-toc-row";
      li.insertBefore(row, topAnchor);

      if (hasSub) {
        var caret = document.createElement("span");
        caret.className = "sg-toc-caret";
        caret.setAttribute("aria-hidden", "true");
        caret.innerHTML = "&#9662;";
        row.appendChild(caret);
        li.classList.add("sg-toc-section");
        caret.addEventListener("click", function (e) {
          e.preventDefault();
          li.classList.toggle("sg-toc-section-collapsed");
          syncCollapseAllLabel();
          persistSubsectionCollapseState();
        });
      } else {
        var spacer = document.createElement("span");
        spacer.className = "sg-toc-caret sg-toc-caret-spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.appendChild(spacer);
      }
      row.appendChild(topAnchor);
    });

    var nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Table of contents");
    nav.appendChild(topList);
    tocRoot.innerHTML = "";
    tocRoot.appendChild(nav);

    applyStoredSubsectionCollapseState();

    // Active-section highlighting
    var links = Array.prototype.slice.call(tocRoot.querySelectorAll("a"));
    if ("IntersectionObserver" in window && links.length) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var link = tocRoot.querySelector('a[href="#' + entry.target.id + '"]');
            if (!link) return;
            if (entry.isIntersecting) {
              links.forEach(function (l) { l.classList.remove("active"); });
              link.classList.add("active");
              // If the newly-active heading is a sub-item whose parent section is
              // collapsed, expand that section so the highlighted entry is actually visible.
              var parentSection = link.closest(".sg-toc-section");
              if (parentSection && parentSection.classList.contains("sg-toc-section-collapsed") &&
                  !parentSection.querySelector(":scope > .sg-toc-row a").isSameNode(link)) {
                parentSection.classList.remove("sg-toc-section-collapsed");
                syncCollapseAllLabel();
              }
            }
          });
        },
        { rootMargin: "-100px 0px -70% 0px" }
      );
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  // ---------- Per-section TOC collapse: bulk "Collapse/Expand Sub-sections" button ----------
  function getTocSections() {
    return Array.prototype.slice.call(document.querySelectorAll(".sg-toc-section"));
  }

  function syncCollapseAllLabel() {
    var btn = document.getElementById("sg-toc-collapse-all");
    if (!btn) return;
    var sections = getTocSections();
    if (!sections.length) {
      btn.style.display = "none";
      return;
    }
    var allCollapsed = sections.every(function (li) {
      return li.classList.contains("sg-toc-section-collapsed");
    });
    var label = btn.querySelector(".sg-btn-label");
    if (label) label.textContent = allCollapsed ? "Expand Sub-sections" : "Collapse Sub-sections";
    btn.setAttribute("aria-pressed", String(allCollapsed));
  }

  function persistSubsectionCollapseState() {
    var sections = getTocSections();
    if (!sections.length) return;
    var allCollapsed = sections.every(function (li) {
      return li.classList.contains("sg-toc-section-collapsed");
    });
    try { localStorage.setItem("sg-toc-subsections-collapsed", allCollapsed ? "1" : "0"); } catch (e) {}
  }

  function applyStoredSubsectionCollapseState() {
    var stored = null;
    try { stored = localStorage.getItem("sg-toc-subsections-collapsed"); } catch (e) {}
    if (stored === "1") {
      getTocSections().forEach(function (li) { li.classList.add("sg-toc-section-collapsed"); });
    }
    syncCollapseAllLabel();
  }

  function initCollapseSubsectionsButton() {
    var btn = document.getElementById("sg-toc-collapse-all");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var sections = getTocSections();
      if (!sections.length) return;
      var allCollapsed = sections.every(function (li) {
        return li.classList.contains("sg-toc-section-collapsed");
      });
      var makeCollapsed = !allCollapsed;
      sections.forEach(function (li) {
        li.classList.toggle("sg-toc-section-collapsed", makeCollapsed);
      });
      syncCollapseAllLabel();
      persistSubsectionCollapseState();
    });
  }

  // ---------- Info popover (Generated date + scope badges, tucked behind an (i) button) ----------
  // Removed 2026-08-05: the level-filter checkbox toolbar that used to live in this same header
  // space — the guide's scope/depth was already set by the generation prompt, the reader already
  // knows what they asked for, and content is never conditionally hidden. Don't re-add a filter.
  function initInfoPopover() {
    var btn = document.getElementById("sg-info-toggle");
    var popover = document.getElementById("sg-info-popover");
    var wrap = document.querySelector(".sg-info-wrap");
    if (!btn || !popover || !wrap) return;

    function setOpen(open) {
      wrap.classList.toggle("sg-info-open", open);
      btn.setAttribute("aria-expanded", String(open));
      popover.setAttribute("aria-hidden", String(!open));
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!wrap.classList.contains("sg-info-open"));
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // ---------- Theme toggle (dark / light — a true 2-state flip, not a 3-state cycle) ----------
  // Deliberately NOT a system/dark/light cycle: with no explicit data-theme, the page still
  // renders a real dark-or-light appearance via prefers-color-scheme, so a 3rd "system" state
  // is invisible whenever it happens to match the OS's current preference — e.g. on a
  // dark-mode OS, the first click ("system" -> explicit "dark") looks identical to what was
  // already on screen, so the button appeared to need two clicks to do anything. Flipping from
  // the actually-rendered appearance every time removes that dead click entirely.
  function initTheme() {
    var btn = document.getElementById("sg-theme-toggle");
    var root = document.documentElement;
    var stored = null;
    try { stored = localStorage.getItem("sg-theme"); } catch (e) {}
    if (stored === "light" || stored === "dark") root.setAttribute("data-theme", stored);
    // (Already applied synchronously by the inline <script> at the top of <body> too — this is
    // a harmless redundant re-application, kept as a fallback if that script didn't run.)

    if (!btn) return;
    btn.addEventListener("click", function () {
      var explicit = root.getAttribute("data-theme");
      var isDark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = isDark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("sg-theme", next); } catch (e) {}
    });
  }

  // ---------- TOC sidebar collapse (fewer distractions while reading) ----------
  // Collapsing shrinks .sg-toc down to just its rail (buttons stay reachable, icon-only label,
  // to re-expand) rather than hiding it entirely — a fully-hidden trigger would be a dead end.
  // Defaults to OPEN on a first-ever visit (no stored preference); once the user explicitly
  // toggles it, that choice persists across reloads.
  //
  // The *visual* no-flash behavior on load is handled by a tiny inline <script> at the top of
  // <body> (runs before the sidebar is painted, adds html.sg-toc-pref-collapsed synchronously —
  // see style.css's .sg-toc.sg-toc-collapsed / html.sg-toc-pref-collapsed rules). This function
  // still keeps that html-level class in sync on every click, or a click that only clears
  // .sg-toc-collapsed would leave the stale html-level class fighting it.
  function initTocToggle() {
    var btn = document.getElementById("sg-toc-toggle");
    var toc = document.querySelector(".sg-toc");
    var root = document.documentElement;
    if (!btn || !toc) return;

    function apply(collapsed) {
      toc.classList.toggle("sg-toc-collapsed", collapsed);
      root.classList.toggle("sg-toc-pref-collapsed", collapsed);
      btn.setAttribute("aria-pressed", String(collapsed));
      var label = btn.querySelector(".sg-btn-label");
      if (label) label.textContent = collapsed ? "Show Contents" : "Hide Contents";
      btn.title = collapsed ? "Show the contents sidebar" : "Hide the contents sidebar";
    }

    var stored = null;
    try { stored = localStorage.getItem("sg-toc-collapsed"); } catch (e) {}
    apply(stored === "1");

    btn.addEventListener("click", function () {
      var collapsed = !toc.classList.contains("sg-toc-collapsed");
      apply(collapsed);
      try { localStorage.setItem("sg-toc-collapsed", collapsed ? "1" : "0"); } catch (e) {}
    });
  }

  // ---------- Mobile nav: hamburger button + slide-out TOC drawer ----------
  // Independent of the desktop collapse mechanism (initTocToggle) — same #toc sidebar element,
  // but a completely different interaction model at narrow widths (fixed off-canvas drawer +
  // backdrop, opened/closed via .sg-toc-mobile-open rather than the desktop rail button). See
  // style.css's mobile media query for why the desktop sg-toc-collapsed/pref-collapsed state
  // can't be allowed to leak into the drawer's width.
  function initMobileToc() {
    var openBtn = document.getElementById("sg-mobile-menu-toggle");
    var closeBtn = document.getElementById("sg-toc-close");
    var backdrop = document.getElementById("sg-toc-backdrop");
    var toc = document.querySelector(".sg-toc");
    var tocNav = document.getElementById("toc-nav");
    if (!openBtn || !toc || !backdrop) return;

    var mq = window.matchMedia("(max-width: 860px)");

    function isOpen() { return toc.classList.contains("sg-toc-mobile-open"); }

    function setOpen(open) {
      toc.classList.toggle("sg-toc-mobile-open", open);
      backdrop.classList.toggle("sg-toc-mobile-open", open);
      openBtn.setAttribute("aria-expanded", String(open));
      // Only meaningful at mobile widths (the drawer's closed state genuinely hides content
      // off-canvas there); at desktop widths the sidebar is always visible, so no attribute.
      if (mq.matches) toc.setAttribute("aria-hidden", String(!open));
      else toc.removeAttribute("aria-hidden");
      // Prevent the page behind the drawer from scrolling while it's open.
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        // Move focus into the drawer for keyboard/screen-reader users.
        (closeBtn || toc).focus();
      } else if (document.activeElement && toc.contains(document.activeElement)) {
        openBtn.focus();
      }
    }

    openBtn.addEventListener("click", function () { setOpen(true); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
    backdrop.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) setOpen(false);
    });
    // Tapping a TOC link should navigate AND close the drawer, not leave it covering the page.
    if (tocNav) {
      tocNav.addEventListener("click", function (e) {
        if (e.target.closest("a") && isOpen()) setOpen(false);
      });
    }
    // If the viewport is resized (or rotated) past the mobile breakpoint while the drawer is
    // open, close it — otherwise .sg-toc-mobile-open would fight the desktop layout.
    function handleMqChange(e) {
      if (!e.matches && isOpen()) setOpen(false);
    }
    if (mq.addEventListener) mq.addEventListener("change", handleMqChange);
    else if (mq.addListener) mq.addListener(handleMqChange); // older Safari fallback
  }

  // ---------- Mobile relocation: move the info + theme buttons into the drawer's top bar ----------
  // The phone header only has room for hamburger + title (the title already has to
  // ellipsis-truncate just for the hamburger to fit — see style.css's mobile .sg-title rule);
  // there's no space left for the info/theme buttons too. Rather than duplicate those buttons
  // (which would mean two #sg-theme-toggle / #sg-info-popover elements to keep in sync — and
  // duplicate ids are invalid HTML), the exact same DOM nodes are physically moved between the
  // header and .sg-toc-topbar depending on viewport width, mirroring how the single #toc
  // sidebar itself is reused for both the desktop column and the mobile drawer rather than
  // duplicated. Existing listeners (initInfoPopover, initTheme) were bound to these nodes once
  // at startup and keep working no matter which parent currently holds them.
  function initControlsRelocation() {
    var controls = document.querySelector(".sg-header-row > .sg-controls");
    var headerRow = document.querySelector(".sg-header-row");
    var topbar = document.querySelector(".sg-toc-topbar");
    if (!controls || !headerRow || !topbar) return;

    var mq = window.matchMedia("(max-width: 860px)");

    function apply(isMobile) {
      var target = isMobile ? topbar : headerRow;
      if (controls.parentNode !== target) target.appendChild(controls);
    }

    apply(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", function (e) { apply(e.matches); });
    else if (mq.addListener) mq.addListener(function (e) { apply(e.matches); }); // older Safari fallback
  }

  // ---------- Back-to-top ----------
  function initBackToTop() {
    var btn = document.getElementById("sg-back-to-top");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 500);
    });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncHeaderOffset();
    buildToc();
    initCollapseSubsectionsButton();
    initInfoPopover();
    initTheme();
    initTocToggle();
    initMobileToc();
    initControlsRelocation();
    initBackToTop();
  });
})();
