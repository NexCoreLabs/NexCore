// script.js — shared for index & hub
document.addEventListener('DOMContentLoaded', () => {
  const navList = document.getElementById('navList') || document.getElementById('navListHub');
  const navLinks = document.querySelectorAll('.nav-link');
  const revealItems = document.querySelectorAll('.reveal');
  const glass = document.getElementById('glassCard');
  const yearEl = document.getElementById('year') || document.getElementById('yearHub');
  const form = document.getElementById('contactForm');
  const notice = document.getElementById('formNotice');
  const resetBtn = document.getElementById('resetBtn');

// Smooth scroll to the top when the logo is clicked
document.getElementById('logo').addEventListener('click', function (event) {
  event.preventDefault(); // Prevent default anchor behavior
  window.scrollTo({
    top: 0,
    behavior: 'smooth' // Smooth scrolling
  });
});

  // set year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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


                    // Dropdown Menu
const myDropdown = document.getElementById('myDropdown');
const coreMenu = document.getElementById('coreMenu');

coreMenu.addEventListener('click', () => {
    coreMenu.classList.toggle("active");

    if(myDropdown.style.visibility == 'visible' && myDropdown.style.opacity == 1){
        myDropdown.style.visibility = 'hidden';
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = 'translateY(0)';
        myDropdown.style.userSelect = 'none';
    } else{
        myDropdown.style.visibility = 'visible';
        myDropdown.style.opacity = 1;
        myDropdown.style.transform = 'translateY(10px)';
        myDropdown.style.userSelect = 'auto';
    }
});
  
  function filterFunction() {
    const input = document.getElementById("myInput");
    const filter = input.value.toUpperCase();
    const div = document.getElementById("myDropdown");
    const a = div.getElementsByTagName("a");
    for (let i = 0; i < a.length; i++) {
      txtValue = a[i].textContent || a[i].innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        a[i].style.display = "";
      } else {
        a[i].style.display = "none";
      }
    }
  }

  document.addEventListener('click', (event) => {
    if (!coreMenu.contains(event.target) && !myDropdown.contains(event.target)) {
        coreMenu.classList.remove("active");
        myDropdown.style.visibility = 'hidden';
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = 'translateY(0)';
        myDropdown.style.userSelect = 'none';
    }
  });


  // Mobile Preview Transition
  const phone = document.getElementById("phoneMockup");
  if (phone) phone.addEventListener("click", openMobilePreview);
  
  function openMobilePreview() {
      // add the expanding class
  phone.classList.add("expand");

  // wait for the animation to finish (same duration as CSS transition)
  setTimeout(() => {
    window.location.href = "mobile-preview.html";
  }, 900); // 0.8s + small buffer
  }


//   const coreMenu = document.getElementById('coreMenu');
// const dropdown = document.getElementById('myDropdown');
// const dots = Array.from(coreMenu.querySelectorAll('.dot'));

// function openMenu() {
//   // compute each dot's current center and the core center
//   const menuRect = coreMenu.getBoundingClientRect();
//   const centerX = menuRect.left + menuRect.width / 2;
//   const centerY = menuRect.top + menuRect.height / 2;

//   dots.forEach((d, i) => {
//     const r = d.getBoundingClientRect();
//     const dx = centerX - (r.left + r.width / 2);
//     const dy = centerY - (r.top + r.height / 2);

//     // translate to center (uses transform; preserve existing rotate by applying translate)
//     d.style.transition = 'transform 420ms cubic-bezier(.2,.9,.3,1), width 420ms ease, height 420ms ease, box-shadow 420ms ease';
//     d.style.transform = `translate(${dx}px, ${dy}px) scale(${(parseFloat(getComputedStyle(d).width) || 8) / (parseFloat(getComputedStyle(d).width) || 8)})`;
//     d.style.left = '50%'; d.style.top = '50%'; // ensure absolute positioning centered
//   });

//   // after animation, make them visually one (set classes/size)
//   setTimeout(() => {
//     dots.forEach(d => {
//       d.style.transform = 'translate(-50%, -50%)';
//       d.style.left = '50%';
//       d.style.top = '50%';
//       d.style.width = getComputedStyle(coreMenu).getPropertyValue('--dot-active-size') || '16px';
//       d.style.height = getComputedStyle(coreMenu).getPropertyValue('--dot-active-size') || '16px';
//       d.classList.add('pulse');
//     });
//     coreMenu.classList.add('active');
//     dropdown.classList.add('open');
//     dropdown.setAttribute('aria-hidden', 'false');
//   }, 420);
// }

// function closeMenu() {
//   // reverse: remove active flags, animate dots back to hex positions by clearing inline transform
//   dropdown.classList.remove('open');
//   dropdown.setAttribute('aria-hidden', 'true');
//   coreMenu.classList.remove('active');
//   dots.forEach((d) => {
//     d.classList.remove('pulse');
//     // clear explicit width/height so CSS returns them to base size
//     d.style.width = '';
//     d.style.height = '';
//     d.style.transition = 'transform 420ms cubic-bezier(.2,.9,.3,1), width 320ms ease, height 320ms ease';
//     // Clearing transform will return each dot to its CSS positioned location (hex positions)
//     d.style.transform = '';
//     // ensure left/top css isn't forcing it
//     d.style.left = '';
//     d.style.top = '';
//   });
// }

// let opened = false;
// coreMenu.addEventListener('click', (e) => {
//   e.stopPropagation();
//   if (!opened) openMenu(); else closeMenu();
//   opened = !opened;
// });

// // close on outside click
// window.addEventListener('click', (e) => {
//   if (opened && !coreMenu.contains(e.target) && !dropdown.contains(e.target)) {
//     closeMenu();
//     opened = false;
//   }
// });

// // keyboard accessibility: Enter / Space
// coreMenu.addEventListener('keydown', (ev) => {
//   if (ev.key === 'Enter' || ev.key === ' ') {
//     ev.preventDefault();
//     coreMenu.click();
//   }
// });
