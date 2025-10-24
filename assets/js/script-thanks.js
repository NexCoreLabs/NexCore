// function redirectToHome() {
//     setTimeout(function() {
//         window.location.href = 'index.html';
//     }, 5000);
// }

const logoImg = document.getElementById('logoImg');
const link = document.getElementsByClassName('fade');

  link.addEventListener('click', (event) => {
    event.preventDefault();
    logoImg.style.opacity = '1';
    mainContent.style.opacity = '0';
    
    setTimeout(() => {
      window.location.href = event.target.href;
    }, 1000);
  });