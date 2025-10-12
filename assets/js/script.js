// Simple smooth scroll for navigation
document.querySelectorAll('header nav a').forEach(anchor => {
  anchor.addEventListener('click', function(e){
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    target.scrollIntoView({behavior: 'smooth'});
  });
});

// Log a message when the DOM is fully loaded

document.addEventListener("DOMContentLoaded", () => {
  console.log("NexCore Hub loaded successfully.");
});