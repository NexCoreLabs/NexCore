<<<<<<< Updated upstream
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

  if(window.scrollY === 0){
      mainContent.style.opacity = '0';
      myDropdown.style.opacity = '0';
      logoImg.style.opacity = '0.8';
      logoImg.style.left = '50%';
      logoImg.style.top = '10%';
      logoImg.style.width = '600px';

      setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  }
  else{
      window.scrollTo({
      top: 0,
      behavior: 'smooth' // Smooth scrolling
    });
  }
});

document.getElementById('nexcoreSign').addEventListener('click', function(event) {
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
      coreMenu.style
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


const logoImg = document.getElementById('logoImg');
const shape = document.getElementById('shape');
const mainContent = document.querySelector('main');
const links = document.querySelectorAll('a.fade');

links.forEach(link => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    mainContent.style.opacity = '0';
    myDropdown.style.opacity = '0';
    logoImg.style.opacity = '0.8';
    logoImg.style.left = '50%';
    logoImg.style.top = '10%';
    logoImg.style.width = '600px';
    
    setTimeout(() => {
      window.location.href = event.target.href;
    }, 1000);
  });
});

window.onload = () =>{
    logoImg.style.filter = 'drop-shadow(0 0 25px rgba(110, 231, 243, 1)';
    logoImg.style.webkitFilter = 'drop-shadow(0 0 25px rgba(110, 231, 243, 1)';
    logoImg.style.left = '100%';
    logoImg.style.top = '15%';
    logoImg.style.width = '200px';
    mainContent.style.opacity = '1';
    
    setTimeout(() =>{
      logoImg.style.opacity = '0.3';
    }, 1000);
};


const searchInput = document.getElementById('projectSearch');
const projectsContainer = document.getElementById('projects-container');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  const projectCards = projectsContainer.querySelectorAll('.project-card'); // adjust class name if needed

  projectCards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'block' : 'none';
  });
});


if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('service-worker.js')
    .then(() => console.log('✅ Service Worker registered successfully'))
    .catch(err => console.error('Service Worker registration failed:', err));
}

function showWebsiteLabel() {
  // Get the checkbox
  var checkBox = document.getElementById("websiteShow");
  // Get the output text
  var websiteLabel = document.getElementById("websiteURLLabel");

  // If the checkbox is checked, display the output text
  if (checkBox.checked == true){
    websiteLabel.style.display = "block";
    websiteLabel.setAttribute('required', 'required');
  } else {
    websiteLabel.style.display = "none";
    websiteLabel.removeAttribute('required');
  }
}
=======
document.addEventListener("DOMContentLoaded",(()=>{const e=document.getElementById("navList")||document.getElementById("navListHub"),t=document.querySelectorAll(".nav-link"),o=document.querySelectorAll(".reveal"),n=document.getElementById("glassCard"),i=document.getElementById("year")||document.getElementById("yearHub"),l=document.getElementById("contactForm"),d=document.getElementById("formNotice"),s=document.getElementById("resetBtn");document.getElementById("logo").addEventListener("click",(function(e){e.preventDefault(),0===window.scrollY?(mainContent.style.opacity="0",myDropdown.style.opacity="0",logoImg.style.opacity="0.8",logoImg.style.left="50%",logoImg.style.top="10%",logoImg.style.width="600px",setTimeout((()=>{window.location.href="index.html"}),1e3)):window.scrollTo({top:0,behavior:"smooth"})})),document.getElementById("nexcoreSign").addEventListener("click",(function(e){e.preventDefault(),window.scrollTo({top:0,behavior:"smooth"})})),i&&(i.textContent=(new Date).getFullYear()),document.querySelectorAll('a[href^="#"]').forEach((t=>{t.addEventListener("click",(o=>{const n=document.querySelector(t.getAttribute("href"));if(!n)return;o.preventDefault();const i=n.getBoundingClientRect().top+window.pageYOffset-82;window.scrollTo({top:i,behavior:"smooth"}),window.innerWidth<=980&&e&&"flex"===e.style.display&&(e.style.display="")}))}));const a=Array.from(document.querySelectorAll("main section[id]"));window.addEventListener("scroll",(()=>{const e=window.scrollY+120;let o=a[0]&&a[0].id;for(const t of a)t.offsetTop<=e&&(o=t.id);t.forEach((e=>{e.classList.toggle("active",e.getAttribute("href")===`#${o}`||e.getAttribute("href")===o)}))}),{passive:!0});const r=()=>{const e=window.innerHeight;o.forEach((t=>{t.getBoundingClientRect().top<e-80&&t.classList.add("visible")}))};r(),window.addEventListener("scroll",r,{passive:!0}),n&&(document.addEventListener("mousemove",(e=>{const t=n.getBoundingClientRect(),o=t.left+t.width/2,i=t.top+t.height/2,l=(e.clientX-o)/t.width,d=(e.clientY-i)/t.height;n.style.transform=`translate3d(${8*l}px, ${8*d}px, 0) rotate(${1.2*l}deg)`})),document.addEventListener("mouseleave",(()=>{n.style.transform=""}))),l.addEventListener("submit",(e=>{const t=l.name.value.trim(),o=l.email.value.trim(),n=l.message.value.trim();t&&o&&n?d.textContent="Sending...":(e.preventDefault(),d.textContent="Please fill all fields.")})),s.addEventListener("click",(()=>{l.reset(),d.textContent=""}));const c=window.matchMedia("(prefers-reduced-motion: reduce)");c&&c.matches&&(document.querySelectorAll(".bg-orbit").forEach((e=>e.style.animation="none")),document.querySelectorAll(".reveal").forEach((e=>e.classList.add("visible"))));const m=document.getElementById("changing-text");if(!m)return void console.warn("changing-text element not found – tiny rotation aborted");const y=["Powered by NexCore • Driven by ambition","Crafted with care • Inspired by simplicity","Fast • Focused • Clean",'Enhanced for <i class="fa-brands fa-edge" aria-hidden="true"></i> & <i class="fa-brands fa-android" aria-hidden="true"></i>'];let u=0;m.innerHTML=y[u],setInterval((()=>{m.classList.add("fade-out"),setTimeout((()=>{u=(u+1)%y.length,m.innerHTML=y[u],m.offsetHeight,m.classList.remove("fade-out")}),550)}),3e3)}));const myDropdown=document.getElementById("myDropdown"),coreMenu=document.getElementById("coreMenu");function filterFunction(){const e=document.getElementById("myInput").value.toUpperCase(),t=document.getElementById("myDropdown").getElementsByTagName("a");for(let o=0;o<t.length;o++)txtValue=t[o].textContent||t[o].innerText,txtValue.toUpperCase().indexOf(e)>-1?t[o].style.display="":t[o].style.display="none"}coreMenu.addEventListener("click",(()=>{coreMenu.classList.toggle("active"),"visible"==myDropdown.style.visibility&&1==myDropdown.style.opacity?(coreMenu.style,myDropdown.style.visibility="hidden",myDropdown.style.opacity=0,myDropdown.style.transform="translateY(0)",myDropdown.style.userSelect="none"):(myDropdown.style.visibility="visible",myDropdown.style.opacity=1,myDropdown.style.transform="translateY(10px)",myDropdown.style.userSelect="auto")})),document.addEventListener("click",(e=>{coreMenu.contains(e.target)||myDropdown.contains(e.target)||(coreMenu.classList.remove("active"),myDropdown.style.visibility="hidden",myDropdown.style.opacity=0,myDropdown.style.transform="translateY(0)",myDropdown.style.userSelect="none")}));const phone=document.getElementById("phoneMockup");function openMobilePreview(){phone.classList.add("expand"),setTimeout((()=>{window.location.href="mobile-preview.html"}),900)}phone&&phone.addEventListener("click",openMobilePreview);const logoImg=document.getElementById("logoImg"),shape=document.getElementById("shape"),mainContent=document.querySelector("main"),links=document.querySelectorAll("a.fade");links.forEach((e=>{e.addEventListener("click",(e=>{e.preventDefault(),mainContent.style.opacity="0",myDropdown.style.opacity="0",logoImg.style.opacity="0.8",logoImg.style.left="50%",logoImg.style.top="10%",logoImg.style.width="600px",setTimeout((()=>{window.location.href=e.target.href}),1e3)}))})),window.onload=()=>{logoImg.style.filter="drop-shadow(0 0 25px rgba(110, 231, 243, 1)",logoImg.style.webkitFilter="drop-shadow(0 0 25px rgba(110, 231, 243, 1)",logoImg.style.left="100%",logoImg.style.top="15%",logoImg.style.width="200px",mainContent.style.opacity="1",setTimeout((()=>{logoImg.style.opacity="0.3"}),1e3)};const searchInput=document.getElementById("projectSearch"),projectsContainer=document.getElementById("projects-container");function showWebsiteLabel(){var e=document.getElementById("websiteShow"),t=document.getElementById("websiteURLLabel");1==e.checked?t.style.display="block":t.style.display="none"}searchInput.addEventListener("input",(()=>{const e=searchInput.value.toLowerCase();projectsContainer.querySelectorAll(".project-card").forEach((t=>{const o=t.textContent.toLowerCase();t.style.display=o.includes(e)?"block":"none"}))})),document.addEventListener("DOMContentLoaded",(()=>{const e=document.getElementById("changing-text");if(!e)return void console.warn("changing-text element not found – tiny rotation aborted");const t=["Powered by NexCore • Driven by ambition","Crafted with care • Inspired by simplicity","Fast • Focused • Clean",'Enhanced for <i class="fa-brands fa-edge" aria-hidden="true"></i> & <i class="fa-brands fa-android" aria-hidden="true"></i>'];let o=0;e.innerHTML=t[o],setInterval((()=>{e.classList.add("fade-out"),setTimeout((()=>{o=(o+1)%t.length,e.innerHTML=t[o],e.offsetHeight,e.classList.remove("fade-out")}),550)}),3e3)}));const img=document.createElement("img");img.src=project.image,img.loading="lazy",img.alt=project.name+" project thumbnail",card.appendChild(img),document.querySelectorAll('img[loading="lazy"]').forEach((e=>{e.addEventListener("load",(()=>{e.classList.add("is-loaded")}))}));
>>>>>>> Stashed changes
