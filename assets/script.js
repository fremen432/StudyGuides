/*
  study-guide-maker shared script
  Master copy: C:\vc\config\claude\skills\study-guide-maker\assets\script.js
  Deployed copy (what guides actually link to): C:\vc\apps\StudyGuides\assets\script.js
  Vanilla JS, no dependencies, no network calls — every guide must open standalone via file://.

  Every guide links this via "assets/script.js?v=YYYYMMDD" (see template.html), not a bare path
  — GitHub Pages / browsers otherwise cache this aggressively and a returning visitor can sit on
  a stale copy indefinitely after an update. Bump the ?v= date on EVERY guide's <script>/<link>
  tag (a repo-wide find/replace, both this file and style.css share one version string) whenever
  either shared asset changes, in the same commit as the change itself.
*/
(function () {
  "use strict";

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      // A heading that ends (or starts) with a stripped character -- an emoji is the common
      // case -- leaves a dangling "-" once the surrounding whitespace collapses (e.g.
      // "Milan 🏛️" -> "milan-"). Still a technically-valid id, but sloppy; trim it.
      .replace(/^-+|-+$/g, "");
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
  // Tap/click any content photo to open it full-screen — one photo, or (inside a .sg-carousel)
  // swipe through the whole set. Scoped to `.sg-main img` rather than just `figure img` so it
  // also catches any stray content image that isn't figure-wrapped — deliberately NOT scoped to
  // the header/sidebar/icon-sprite, none of which live inside .sg-main. One overlay element,
  // reused for every image/group (built once, not per-photo), matching the existing
  // info-popover/mobile-drawer pattern of a single shared DOM node toggled open.
  //
  // The lightbox is itself a scroll-snap track (same swipe mechanism as the inline
  // .sg-carousel, just full-screen) — a single-photo POI is simply a track with one slide, not
  // a separate code path, so single- and multi-photo POIs share this one implementation.
  function initLightbox() {
    var images = document.querySelectorAll(".sg-main img");
    if (!images.length) return;

    var overlay = document.createElement("div");
    overlay.className = "sg-lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    // Plain "×"/"‹"/"›" glyphs rather than sprite symbols — this script is shared across every
    // guide and not every guide's inline sprite defines the icons a lightbox would want (only
    // the newer mobile-drawer guides carry icon-x, and none carry chevrons), so relying on the
    // sprite here would render blank buttons on older guides.
    overlay.innerHTML =
      '<button type="button" class="sg-lightbox-close" aria-label="Close">×</button>' +
      '<button type="button" class="sg-lightbox-arrow sg-lightbox-prev" aria-label="Previous photo">‹</button>' +
      '<button type="button" class="sg-lightbox-arrow sg-lightbox-next" aria-label="Next photo">›</button>' +
      '<div class="sg-lightbox-track"></div>' +
      '<div class="sg-lightbox-dots"></div>';
    document.body.appendChild(overlay);

    var trackEl = overlay.querySelector(".sg-lightbox-track");
    var dotsEl = overlay.querySelector(".sg-lightbox-dots");
    var closeBtn = overlay.querySelector(".sg-lightbox-close");
    var prevBtn = overlay.querySelector(".sg-lightbox-prev");
    var nextBtn = overlay.querySelector(".sg-lightbox-next");
    var lastFocused = null;
    var slideEls = [];
    var activeIndex = 0;
    var observer = null;

    function captionTextFor(img) {
      var fig = img.closest("figure");
      var caption = fig ? fig.querySelector("figcaption") : null;
      if (!caption) return "";
      // Drop the "- Source: ..." attribution link from the lightbox caption text — it stays as
      // a real link right below the thumbnail in the article itself; repeating it as plain
      // unclickable text over a photo just adds noise.
      var clone = caption.cloneNode(true);
      var sourceEl = clone.querySelector(".sg-figure-source");
      if (sourceEl) sourceEl.remove();
      return clone.textContent.trim();
    }

    // A clicked image's "group" is every sibling slide in the same .sg-carousel-track (a
    // multi-photo POI), or just that one image on its own (a plain standalone <figure> — the
    // overwhelming majority of POIs, one photo each). Same open()/track code renders both; a
    // group of one just has its dots/arrows hidden (style.css's [data-count="1"] rule).
    function groupFor(img) {
      var track = img.closest(".sg-carousel-track");
      if (track) return Array.prototype.slice.call(track.querySelectorAll("img"));
      return [img];
    }

    function setActive(index) {
      activeIndex = index;
      var dots = dotsEl.querySelectorAll(".sg-lightbox-dot");
      dots.forEach(function (dot, i) { dot.classList.toggle("active", i === index); });
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === slideEls.length - 1;
    }

    function goTo(index, smooth) {
      index = Math.max(0, Math.min(slideEls.length - 1, index));
      var slide = slideEls[index];
      if (!slide) return;
      slide.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
    }

    function open(imgs, startIndex) {
      lastFocused = document.activeElement;
      trackEl.innerHTML = "";
      dotsEl.innerHTML = "";
      slideEls = [];

      imgs.forEach(function (srcImg, i) {
        var slide = document.createElement("figure");
        slide.className = "sg-lightbox-slide";
        var im = document.createElement("img");
        im.className = "sg-lightbox-img";
        im.src = srcImg.currentSrc || srcImg.src;
        im.alt = srcImg.alt || "";
        slide.appendChild(im);

        var capText = captionTextFor(srcImg);
        if (capText) {
          var cap = document.createElement("figcaption");
          cap.className = "sg-lightbox-caption";
          cap.textContent = capText;
          cap.addEventListener("click", function (e) { e.stopPropagation(); });
          slide.appendChild(cap);
        }
        trackEl.appendChild(slide);
        slideEls.push(slide);

        if (imgs.length > 1) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "sg-lightbox-dot";
          dot.setAttribute("aria-label", "Photo " + (i + 1) + " of " + imgs.length);
          dot.addEventListener("click", function (e) {
            e.stopPropagation();
            goTo(i, true);
          });
          dotsEl.appendChild(dot);
        }
      });

      overlay.setAttribute("data-count", String(imgs.length));
      overlay.classList.add("sg-lightbox-open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      goTo(startIndex, false);
      setActive(startIndex);
      closeBtn.focus();

      if (observer) observer.disconnect();
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActive(slideEls.indexOf(entry.target));
          });
        },
        { root: trackEl, threshold: 0.6 }
      );
      slideEls.forEach(function (s) { observer.observe(s); });
    }

    function close() {
      overlay.classList.remove("sg-lightbox-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (observer) { observer.disconnect(); observer = null; }
      trackEl.innerHTML = "";
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }

    // Click anywhere in the overlay (backdrop OR the enlarged image itself) closes it — the
    // simplest no-dead-zone lightbox pattern. Captions, dots, arrows, and the close button all
    // opt out via stopPropagation on their own click handlers.
    overlay.addEventListener("click", close);
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); close(); });
    prevBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(activeIndex - 1, true); });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(activeIndex + 1, true); });
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("sg-lightbox-open")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowLeft") { goTo(activeIndex - 1, true); return; }
      if (e.key === "ArrowRight") { goTo(activeIndex + 1, true); return; }
    });

    images.forEach(function (img) {
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "View full-screen: " + (img.alt || "image"));
      img.addEventListener("click", function () {
        var group = groupFor(img);
        open(group, group.indexOf(img));
      });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          img.click();
        }
      });
    });
  }

  // ---------- Inline swipeable photo carousel (.sg-carousel, 2+ photos per POI) ----------
  // The actual swipe/drag comes free from CSS scroll-snap on .sg-carousel-track (real touch
  // momentum, no JS gesture math). This just wires up the dot indicators (via
  // IntersectionObserver, same technique as the lightbox above) and the prev/next buttons.
  function initCarousels() {
    var carousels = document.querySelectorAll(".sg-carousel");
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector(".sg-carousel-track");
      var slides = Array.prototype.slice.call(track.querySelectorAll("figure"));
      if (slides.length < 2) return; // a lone photo needs no dots/arrows/observer at all

      var dotsEl = document.createElement("div");
      dotsEl.className = "sg-carousel-dots";
      var prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "sg-carousel-arrow sg-carousel-prev";
      prevBtn.setAttribute("aria-label", "Previous photo");
      prevBtn.textContent = "‹";
      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "sg-carousel-arrow sg-carousel-next";
      nextBtn.setAttribute("aria-label", "Next photo");
      nextBtn.textContent = "›";
      carousel.appendChild(prevBtn);
      carousel.appendChild(nextBtn);
      carousel.appendChild(dotsEl);

      var activeIndex = 0;
      slides.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "sg-carousel-dot";
        dot.setAttribute("aria-label", "Photo " + (i + 1) + " of " + slides.length);
        dot.addEventListener("click", function () { goTo(i, true); });
        dotsEl.appendChild(dot);
      });

      function setActive(index) {
        activeIndex = index;
        dotsEl.querySelectorAll(".sg-carousel-dot").forEach(function (dot, i) {
          dot.classList.toggle("active", i === index);
        });
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === slides.length - 1;
      }
      function goTo(index, smooth) {
        index = Math.max(0, Math.min(slides.length - 1, index));
        slides[index].scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
      }

      prevBtn.addEventListener("click", function () { goTo(activeIndex - 1, true); });
      nextBtn.addEventListener("click", function () { goTo(activeIndex + 1, true); });

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActive(slides.indexOf(entry.target));
          });
        },
        { root: track, threshold: 0.6 }
      );
      slides.forEach(function (s) { observer.observe(s); });
      setActive(0);
    });
  }

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

  // ---------- Refresh Page button (lives in the TOC rail, so it's reachable from both the
  // desktop sidebar and the mobile hamburger drawer — same element, no separate mobile-only
  // markup needed). Built here rather than hand-added to every guide's HTML so it's live on
  // every guide the moment this shared script updates, with no per-file edit. Injected as raw
  // SVG (not a <use href="#icon-x"> sprite reference) for the same reason the lightbox's own
  // buttons use plain glyphs, per the comment in initLightbox() above: not every guide's inline
  // sprite defines the icons a shared button would want, so relying on one here would render
  // blank on older guides.
  // Trip Map — promoted 2026-08-23 from a one-off built for "Italy Trip 2026 - Travel
  // Companion.html", once a second guide (Germany Trip 2027) wanted the same thing. Reads two
  // JSON islands the guide embeds itself: #sg-tripmap-data (an array of points) and
  // #sg-tripmap-config ({routeOrder, legDates}). A guide with neither element (i.e. every guide
  // without a Trip Map) hits the early return on the very first line and pays nothing for this.
  // Leaflet itself is NOT a shared dependency — each guide that wants a map includes the
  // leaflet.css/leaflet.js CDN tags itself (see template.html's comment on this), so this
  // function silently no-ops if L is undefined too, rather than throwing.
  function initTripMap() {
    var canvas = document.getElementById("sg-tripmap-canvas");
    var dataEl = document.getElementById("sg-tripmap-data");
    if (!canvas || !dataEl || typeof L === "undefined") return;

    var points;
    try {
      points = JSON.parse(dataEl.textContent);
    } catch (e) {
      canvas.textContent = "Map data failed to load.";
      return;
    }

    var config = {};
    var configEl = document.getElementById("sg-tripmap-config");
    if (configEl) {
      try { config = JSON.parse(configEl.textContent) || {}; } catch (e) { config = {}; }
    }
    var routeOrder = config.routeOrder || [];
    var legDates = config.legDates || {};

    var stays = points.filter(function (p) { return p.kind === "stay"; });
    stays.sort(function (a, b) {
      return routeOrder.indexOf(a.city) - routeOrder.indexOf(b.city);
    });

    function isDark() {
      var explicit = document.documentElement.getAttribute("data-theme");
      if (explicit === "dark") return true;
      if (explicit === "light") return false;
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    var TILE_LAYERS = {
      light: {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\" target=\"_blank\" rel=\"noopener\">CARTO</a>"
      },
      dark: {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\" target=\"_blank\" rel=\"noopener\">CARTO</a>"
      }
    };

    var map = L.map(canvas, { scrollWheelZoom: false });
    var tileLayer = null;
    var routeLine = null; // assigned once the route is drawn below; re-themed here too

    function applyTileTheme() {
      var cfg = isDark() ? TILE_LAYERS.dark : TILE_LAYERS.light;
      if (tileLayer) map.removeLayer(tileLayer);
      tileLayer = L.tileLayer(cfg.url, {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: cfg.attribution
      }).addTo(map);
      if (routeLine) {
        routeLine.setStyle({ color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2f8f5b" });
      }
    }
    applyTileTheme();

    // Re-tile on theme change — covers the header's light/dark toggle button (which flips
    // documentElement's data-theme) and a live OS-level scheme switch (which the toggle
    // script also honors when no explicit choice has been saved).
    new MutationObserver(applyTileTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", applyTileTheme);
      else if (mq.addListener) mq.addListener(applyTileTheme);
    }

    function pinIcon(kind, size) {
      var iconMap = { stay: "icon-home", restaurant: "icon-utensils", poi: "icon-eye" };
      var html = '<div class="sg-tripmap-pin sg-tripmap-pin--' + kind + '">' +
        '<svg class="sg-icon" aria-hidden="true"><use href="#' + iconMap[kind] + '"></use></svg></div>';
      return L.divIcon({ html: html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
    }
    var ICONS = { stay: pinIcon("stay", 34), restaurant: pinIcon("restaurant", 24), poi: pinIcon("poi", 22) };
    var KIND_LABEL = { stay: "🏠 Where you're staying", restaurant: "🍴 Restaurant / food stop", poi: "👁️ Sight / point of interest" };

    var allLatLngs = [];
    // One layer group per pin kind (not one shared group) so the legend chips can show/hide
    // an entire category by adding/removing its group — cheaper and simpler than walking
    // every marker on every toggle. Every group starts added to the map (all pins visible on
    // load); nothing here is persisted across a refresh, so a reload always comes back to
    // this same all-visible default regardless of what was toggled off before.
    var LAYERS = { stay: L.layerGroup(), restaurant: L.layerGroup(), poi: L.layerGroup() };

    function escAttr(s) {
      return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    }

    // Up to 2 of the location's own photos (already embedded in the article, same files —
    // no separate image set to keep in sync) as a header strip on its popup. A 3rd+ photo
    // becomes a "+N" badge on the last thumbnail rather than being dropped silently, so it's
    // clear there's more to see in the full write-up below. A point with no images (common —
    // this is optional per-point) just skips the strip entirely.
    function photoStripHtml(p) {
      if (!p.images || !p.images.length) return "";
      var shown = p.images.slice(0, 2);
      var extra = p.images.length - shown.length;
      var cells = shown.map(function (src, i) {
        var badge = (i === shown.length - 1 && extra > 0)
          ? '<span class="sg-tripmap-popup-photo-more">+' + extra + '</span>'
          : "";
        return '<a class="sg-tripmap-popup-photo" href="' + src + '" target="_blank" rel="noopener">' +
          '<img src="' + src + '" alt="' + escAttr(p.name) + '" loading="lazy">' + badge + '</a>';
      }).join("");
      return '<div class="sg-tripmap-popup-photos" data-count="' + shown.length + '">' + cells + '</div>';
    }

    points.forEach(function (p) {
      var ll = [p.lat, p.lon];
      allLatLngs.push(ll);
      var marker = L.marker(ll, { icon: ICONS[p.kind] || ICONS.poi, riseOnHover: true });
      var stopNote = "";
      if (p.kind === "stay") {
        stopNote = '<div class="sg-tripmap-popup-city">Home base ' + (stays.indexOf(p) + 1) + ' of ' + stays.length + '</div>';
      }
      var leg = legDates[p.city];
      var datesLine = leg
        ? '<div class="sg-tripmap-popup-dates">📅 ' + leg.range + ' &middot; ' + leg.days + (leg.days === 1 ? " day" : " days") + '</div>'
        : "";
      var mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.mapsQuery);
      var popupHtml =
        photoStripHtml(p) +
        '<div class="sg-tripmap-popup-kind">' + KIND_LABEL[p.kind] + '</div>' +
        '<div class="sg-tripmap-popup-name">' + p.name + '</div>' +
        '<div class="sg-tripmap-popup-city">' + p.city + '</div>' +
        datesLine +
        stopNote +
        '<a class="sg-tripmap-popup-link" href="' + mapsUrl + '" target="_blank" rel="noopener">Open in Google Maps &rarr;</a>';
      marker.bindPopup(popupHtml, { maxWidth: 260 });
      (LAYERS[p.kind] || LAYERS.poi).addLayer(marker);
    });
    Object.keys(LAYERS).forEach(function (kind) { LAYERS[kind].addTo(map); });

    // Legend chips double as filter toggles.
    document.querySelectorAll(".sg-tripmap-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.dataset.kind;
        var layer = LAYERS[kind];
        if (!layer) return;
        var showing = btn.getAttribute("aria-pressed") === "true";
        var next = !showing;
        btn.setAttribute("aria-pressed", String(next));
        if (next) map.addLayer(layer); else map.removeLayer(layer);
      });
    });

    // Zoom-to-fit button — always fits every pin regardless of which kinds are currently
    // toggled off, so it doubles as a "reset the view" control.
    var fitBtn = document.getElementById("sg-tripmap-fit");
    if (fitBtn) {
      fitBtn.addEventListener("click", function () {
        if (allLatLngs.length) map.fitBounds(L.latLngBounds(allLatLngs), { padding: [28, 28] });
      });
    }

    // Dashed route line between home bases, in travel order, with rotated chevrons pointing
    // toward the next stop repeated along each segment — not just one at the exact midpoint —
    // so a chevron is still in view after zooming into any one leg of a long segment, not only
    // when the whole segment is visible at once.
    if (stays.length > 1) {
      var routeLatLngs = stays.map(function (s) { return [s.lat, s.lon]; });
      L.polyline(routeLatLngs, {
        color: "#ffffff", weight: 5, opacity: 0.55, dashArray: null, lineCap: "round"
      }).addTo(map);
      routeLine = L.polyline(routeLatLngs, {
        color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2f8f5b",
        weight: 3, opacity: 0.95, dashArray: "1, 9", lineCap: "round"
      }).addTo(map);

      function bearing(a, b) {
        var lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
        var dLon = (b[1] - a[1]) * Math.PI / 180;
        var y = Math.sin(dLon) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      }

      // Haversine, in km — just to decide how many chevrons a segment earns, not for display,
      // so the simple spherical-Earth approximation is more than accurate enough here.
      function distanceKm(a, b) {
        var R = 6371;
        var dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
        var lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
        var h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
      }

      var ARROW_SPACING_KM = 70; // roughly one chevron every 70km of a leg
      var ARROW_MAX_PER_LEG = 6; // cap so a very long leg (e.g. a cross-country transfer) doesn't clutter

      for (var i = 0; i < routeLatLngs.length - 1; i++) {
        var a = routeLatLngs[i], b = routeLatLngs[i + 1];
        var deg = bearing(a, b);
        var legKm = distanceKm(a, b);
        var count = Math.min(ARROW_MAX_PER_LEG, Math.max(1, Math.round(legKm / ARROW_SPACING_KM)));
        var arrowHtml = '<div class="sg-tripmap-arrow" style="transform:rotate(' + deg + 'deg)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#icon-arrow-narrow-up"></use></svg></div>';
        var icon = L.divIcon({ html: arrowHtml, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
        // Evenly spaced along the leg (not including the endpoints themselves) — e.g. count=1
        // places one chevron at the midpoint same as before, count=3 places them at 25/50/75%.
        for (var j = 1; j <= count; j++) {
          var t = j / (count + 1);
          var pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          L.marker(pt, { icon: icon, interactive: false, keyboard: false }).addTo(map);
        }
      }
    }

    if (allLatLngs.length) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [28, 28] });
    }

    // Let the page scroll normally until the visitor deliberately interacts with the map —
    // otherwise an idle two-finger scroll-past on mobile (or an accidental wheel-over on
    // desktop) gets eaten by the map's own zoom instead of scrolling the page.
    canvas.addEventListener("click", function () { map.scrollWheelZoom.enable(); });
    map.on("focus", function () { map.scrollWheelZoom.enable(); });
    map.on("blur", function () { map.scrollWheelZoom.disable(); });

    // Tapping a popup photo opens the guide's own lightbox carousel (initLightbox() below)
    // instead of a new tab — showing every photo for that POI (not just the 2 in the popup)
    // with captions/sources, exactly like tapping the same photo down in the article. Popup
    // content is created fresh each time a marker opens, so this is delegated on the map
    // canvas (which persists for the page's life) rather than bound per-photo. Forwarding a
    // synthetic click to the matching original <img> — instead of duplicating the lightbox's
    // open()/group-detection logic here — is what makes this "just work": that original
    // image is already wired up by initLightbox() at page load, group and all.
    canvas.addEventListener("click", function (e) {
      var link = e.target.closest(".sg-tripmap-popup-photo");
      if (!link) return;
      e.preventDefault();
      var src = link.getAttribute("href");
      // Exclude #sg-tripmap itself — the popup's own <img> (this very photo) shares the same
      // src and, since the Trip Map section typically sits near the top of the document, can
      // sort before the real article image in DOM order. A plain querySelector would match
      // the popup's own un-wired <img> and silently do nothing.
      var candidates = src ? document.querySelectorAll('.sg-main img[src="' + CSS.escape(src) + '"]') : [];
      var original = null;
      for (var ci = 0; ci < candidates.length; ci++) {
        if (!candidates[ci].closest("#sg-tripmap")) { original = candidates[ci]; break; }
      }
      if (original) original.click();
      else if (src) window.open(src, "_blank", "noopener");
    });

    // ---------- Fullscreen toggle ----------
    // CSS-class overlay rather than the real Fullscreen API — see the .sg-tripmap--fs CSS
    // comment for why (iOS Safari has no Element.requestFullscreen).
    var wrap = document.getElementById("sg-tripmap");
    var fsBtn = document.getElementById("sg-tripmap-fullscreen");
    var fsActive = false;

    function setFullscreen(active) {
      fsActive = active;
      wrap.classList.toggle("sg-tripmap--fs", active);
      document.body.classList.toggle("sg-tripmap-fs-lock", active);
      if (fsBtn) {
        fsBtn.querySelector("use").setAttribute("href", active ? "#icon-minimize" : "#icon-maximize");
        fsBtn.title = active ? "Exit fullscreen" : "View map fullscreen";
      }
      setTimeout(function () { map.invalidateSize(); }, 80);
    }

    if (fsBtn) {
      fsBtn.addEventListener("click", function () { setFullscreen(!fsActive); });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && fsActive) setFullscreen(false);
    });
  }

  function initRefreshButton() {
    var rail = document.querySelector(".sg-toc-rail");
    if (!rail) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sg-btn";
    btn.id = "sg-toc-refresh";
    btn.title = "Reload this page";
    btn.innerHTML =
      '<svg class="sg-icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />' +
      '<path d="M3 3v5h5" />' +
      '<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />' +
      '<path d="M16 16h5v5" />' +
      '</svg><span class="sg-btn-label">Refresh Page</span>';
    btn.addEventListener("click", function () { window.location.reload(); });
    rail.appendChild(btn);
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
    initCarousels();
    initLightbox();
    initRefreshButton();
    initTripMap();
  });
})();
