// script.js — shared for index & hub
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle') || document.getElementById('menuToggleHub');
  const navList = document.getElementById('navList') || document.getElementById('navListHub');
  const navLinks = document.querySelectorAll('.nav-link');
  const revealItems = document.querySelectorAll('.reveal');
  const glass = document.getElementById('glassCard');
  const yearEl = document.getElementById('year') || document.getElementById('yearHub');
  const form = document.getElementById('contactForm');
  const notice = document.getElementById('formNotice');
  const resetBtn = document.getElementById('resetBtn');

  // set year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // mobile menu toggle
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navList.style.display === 'flex';
      navList.style.display = isOpen ? '' : 'flex';
      menuToggle.setAttribute('aria-expanded', (!isOpen).toString());
    });
  }

  // smooth scroll offset for anchored links on same page
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      ev.preventDefault();
      const headerOffset = 82;
      const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

      if (window.innerWidth <= 980 && navList && navList.style.display === 'flex') {
        navList.style.display = '';
      }
    });
  });

  // scroll spy (active nav)
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  window.addEventListener('scroll', () => {
    const fromTop = window.scrollY + 120;
    let current = sections[0] && sections[0].id;
    for (const sec of sections) {
      if (sec.offsetTop <= fromTop) current = sec.id;
    }
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}` || link.getAttribute('href') === current);
    });
  }, { passive: true });

  // reveal on scroll
  const revealOnScroll = () => {
    const bottom = window.innerHeight;
    revealItems.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < bottom - 80) el.classList.add('visible');
    });
  };
  revealOnScroll();
  window.addEventListener('scroll', revealOnScroll, { passive: true });

  // subtle parallax on glass card with mouse move
  if (glass) {
    document.addEventListener('mousemove', (e) => {
      const rect = glass.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      glass.style.transform = `translate3d(${dx * 8}px, ${dy * 8}px, 0) rotate(${dx * 1.2}deg)`;
    });
    document.addEventListener('mouseleave', () => { glass.style.transform = ''; });
  }

  // simple form handling (no back-end). Validate & simulate send.
form.addEventListener('submit', (ev) => {
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();

  if (!name || !email || !message) {
    ev.preventDefault(); // block submission only if invalid
    notice.textContent = 'Please fill all fields.';
  } else {
    notice.textContent = 'Sending...';
  }
});

resetBtn.addEventListener('click', () => {
  form.reset();
  notice.textContent = '';
});


  // respect reduced motion
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (media && media.matches) {
    document.querySelectorAll('.bg-orbit').forEach(n => n.style.animation = 'none');
    document.querySelectorAll('.reveal').forEach(n => n.classList.add('visible'));
  }
});

// Toggle menu
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("active");
});

// Sticky fade on scroll
window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 30) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});