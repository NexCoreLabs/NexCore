document.addEventListener('DOMContentLoaded', () => {
    // Safety check: element exists
    const textElement = document.getElementById('changing-text');
    if (!textElement) {
      console.warn('changing-text element not found – tiny rotation aborted');
      return;
    }

    // Sentences — note: these are HTML strings for innerHTML
    const sentences = [
      "Powered by NexCore • Driven by ambition",
      "Crafted with care • Inspired by simplicity",
      "Fast • Focused • Clean",
      // brand icons will render if Font Awesome CSS loaded
      'Enhanced for <i class="fa-brands fa-edge" aria-hidden="true"></i> & <i class="fa-brands fa-android" aria-hidden="true"></i>'
    ];

    // initial index: show first sentence immediately (index 0 already in HTML)
    let index = 0;
    const changeInterval = 3000; // milliseconds
    const fadeDuration = 550; // should match CSS transition (ms)

    // Ensure initial content is the first sentence (in case footer HTML changed)
    textElement.innerHTML = sentences[index];

    // Rotator
    setInterval(() => {
      // fade out
      textElement.classList.add('fade-out');

      // after fade duration, change text and fade in
      setTimeout(() => {
        index = (index + 1) % sentences.length;
        textElement.innerHTML = sentences[index];

        // force reflow to allow transition to apply consistently
        // (read offsetHeight triggers reflow)
        void textElement.offsetHeight;

        // fade in
        textElement.classList.remove('fade-out');
      }, fadeDuration);
    }, changeInterval);
  });