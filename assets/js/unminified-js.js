// script.js — all custom JS for NexCore site

// Simple analytics: track page visits
async function trackVisit() {
  try {
    await fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_path: window.location.pathname
      })
    });
  } catch (e) {
    // silent fail – analytics should never break UX
  }
}

window.addEventListener("load", trackVisit);

document.addEventListener("DOMContentLoaded", () => {
  // Attach signature scroll top listener early
  const setupSign = () => {
    const sign = document.querySelector(".nexcore-sign") || document.getElementById("nexcoreSign");
    if (sign) {
      sign.style.cursor = "pointer";
      sign.onclick = (e) => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Fallback for immediate jump
        setTimeout(() => {
          if (window.scrollY > 0) window.scrollTo(0, 0);
        }, 500);
      };
    }
  };
  setupSign();

  const navList = document.getElementById("navList") || document.getElementById("navListHub");
  const navLinks = document.querySelectorAll(".nav-link");
  const revealItems = document.querySelectorAll(".reveal");
  const glass = document.getElementById("glassCard");
  const yearEl = document.getElementById("year") || document.getElementById("yearHub");
  const form = document.getElementById("contactForm");
  const notice = document.getElementById("formNotice");
  const resetBtn = document.getElementById("resetBtn");
  const logoImg = document.getElementById("logoImg");
  const mainContent = document.querySelector("main");
  const myDropdown = document.getElementById("myDropdown");
  const coreMenu = document.getElementById("coreMenu");
  const phone = document.getElementById("phoneMockup");
  const links = document.querySelectorAll("a.fade");
  const searchInput = document.getElementById("projectSearch");
  const projectsContainer = document.getElementById("projects-container");

  // Smooth scroll to the top when the logo is clicked
  const logoTrigger = document.getElementById("logo");
  if (logoTrigger) {
    logoTrigger.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.scrollY === 0) {
        if (mainContent) mainContent.style.opacity = "0";
        if (myDropdown) myDropdown.style.opacity = "0";
        if (logoImg) {
          logoImg.style.opacity = "0.8";
          logoImg.style.left = "50%";
          logoImg.style.top = "10%";
          logoImg.style.width = "600px";
        }
        setTimeout(() => { window.location.href = "index.html"; }, 1000);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  // set year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // smooth scroll offset for anchored links on same page
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const href = a.getAttribute("href");
      if (href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      const headerOffset = 82;
      const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });

      if (window.innerWidth <= 980 && navList && navList.style.display === "flex") {
        navList.style.display = "";
      }
    });
  });

  // scroll spy (active nav)
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  if (sections.length > 0) {
    window.addEventListener("scroll", () => {
      const fromTop = window.scrollY + 120;
      let current = sections[0].id;
      for (const sec of sections) {
        if (sec.offsetTop <= fromTop) current = sec.id;
      }
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${current}` || link.getAttribute("href") === current);
      });
    }, { passive: true });
  }

  // Reveal elements on scroll using IntersectionObserver (more robust)
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealItems.forEach(el => revealObserver.observe(el));

  // Image Lazy Loading Fix using IntersectionObserver
  const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const handleLoad = () => img.classList.add("is-loaded");
        if (img.complete) {
          handleLoad();
        } else {
          img.addEventListener("load", handleLoad);
        }
        imgObserver.unobserve(img);
      }
    });
  }, { rootMargin: "50px" });

  document.querySelectorAll('img[loading="lazy"]').forEach(img => imgObserver.observe(img));

  // subtle parallax on glass card with mouse move
  if (glass) {
    document.addEventListener("mousemove", (e) => {
      const rect = glass.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      glass.style.transform = `translate3d(${dx * 8}px, ${dy * 8}px, 0) rotate(${dx * 1.2}deg)`;
    });
    document.addEventListener("mouseleave", () => { glass.style.transform = ""; });
  }

  // simple form handling
  if (form) {
    form.addEventListener("submit", (ev) => {
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      if (!name || !email || !message) {
        ev.preventDefault();
        if (notice) notice.textContent = "Please fill all fields.";
      } else {
        if (notice) notice.textContent = "Sending...";
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (form) form.reset();
      if (notice) notice.textContent = "";
    });
  }

  // respect reduced motion
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (media && media.matches) {
    document.querySelectorAll(".bg-orbit").forEach((n) => (n.style.animation = "none"));
    document.querySelectorAll(".reveal").forEach((n) => n.classList.add("visible"));
  }

  // Changing Text Rotator
  const textElement = document.getElementById("changing-text");
  if (textElement) {
    const sentences = [
      `<div class="flag-includes"><img src="assets/images/oman.webp" alt="Oman flag"><span>Proudly Built in Oman</span></div>`,
      `<div class="flag-includes"><img src="assets/images/eu.webp" alt="EU flag"><span>EU GDPR-aligned</span></div>`,
      "The margin between good and great is care.",
      "Real. Useful. Done.",
      "Showcase • Discover • Collaborate",
      'Enhanced for <i class="fa-brands fa-edge" aria-hidden="true"></i> & <i class="fa-brands fa-android" aria-hidden="true"></i>',
    ];

    let index = 0;
    textElement.innerHTML = sentences[index];

    setInterval(() => {
      textElement.classList.add("fade-out");
      setTimeout(() => {
        index = (index + 1) % sentences.length;
        textElement.innerHTML = sentences[index];
        void textElement.offsetHeight;
        textElement.classList.remove("fade-out");
      }, 550);
    }, 3000);
  }

  // Dropdown Menu Logic
  if (coreMenu && myDropdown) {
    coreMenu.addEventListener("click", () => {
      coreMenu.classList.toggle("active");
      if (myDropdown.style.visibility == "visible" && myDropdown.style.opacity == 1) {
        myDropdown.style.visibility = "hidden";
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = "translateY(0)";
        myDropdown.style.userSelect = "none";
      } else {
        myDropdown.style.visibility = "visible";
        myDropdown.style.opacity = 1;
        myDropdown.style.transform = "translateY(10px)";
        myDropdown.style.userSelect = "auto";
      }
    });

    document.addEventListener("click", (event) => {
      if (!coreMenu.contains(event.target) && !myDropdown.contains(event.target)) {
        coreMenu.classList.remove("active");
        myDropdown.style.visibility = "hidden";
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = "translateY(0)";
        myDropdown.style.userSelect = "none";
      }
    });
  }

  // Mobile Preview Transition
  if (phone) {
    phone.addEventListener("click", () => {
      phone.classList.add("expand");
      setTimeout(() => { window.location.href = "mobile-preview.html"; }, 900);
    });
  }

  // Fade links
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.href;
      if (!href) return;
      event.preventDefault();
      if (mainContent) mainContent.style.opacity = "0";
      if (myDropdown) myDropdown.style.opacity = "0";
      if (logoImg) {
        logoImg.style.opacity = "0.8";
        logoImg.style.left = "50%";
        logoImg.style.top = "10%";
        logoImg.style.width = "600px";
      }
      setTimeout(() => { window.location.href = href; }, 1000);
    });
  });

  // Project Search
  if (searchInput && projectsContainer) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase();
      const projectCards = projectsContainer.querySelectorAll(".project-card");
      projectCards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? "block" : "none";
      });
    });
  }

  // Initial animation
  if (logoImg) {
    logoImg.style.filter = "drop-shadow(0 0 25px rgba(110, 231, 243, 1))";
    logoImg.style.webkitFilter = "drop-shadow(0 0 25px rgba(110, 231, 243, 1))";
    logoImg.style.left = "100%";
    logoImg.style.top = "15%";
    logoImg.style.width = "200px";
    setTimeout(() => { logoImg.style.opacity = "0.3"; }, 1000);
  }
  
  if (mainContent) {
    mainContent.style.opacity = "1";
  }
});

function filterFunction() {
  const input = document.getElementById("myInput");
  const filter = input ? input.value.toUpperCase() : "";
  const div = document.getElementById("myDropdown");
  if (!div) return;
  const a = div.getElementsByTagName("a");
  for (let i = 0; i < a.length; i++) {
    const txtValue = a[i].textContent || a[i].innerText;
    if (txtValue.toUpperCase().indexOf(filter) > -1) {
      a[i].style.display = "";
    } else {
      a[i].style.display = "none";
    }
  }
}

function showWebsiteLabel() {
  const checkBox = document.getElementById("websiteShow");
  const websiteLabel = document.getElementById("websiteURLLabel");
  if (!checkBox || !websiteLabel) return;
  if (checkBox.checked) {
    websiteLabel.style.display = "block";
    websiteLabel.setAttribute("required", "required");
  } else {
    websiteLabel.style.display = "none";
    websiteLabel.removeAttribute("required");
  }
}