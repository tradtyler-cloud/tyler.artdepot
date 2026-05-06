document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('.panel');
    const navLinks = document.querySelectorAll('.nav-links a');
    const container = document.querySelector('.content-container');

    container.addEventListener('scroll', () => {
        let current = "";
        panels.forEach(panel => {
            const panelTop = panel.offsetTop;
            const panelHeight = panel.clientHeight;
            if (container.scrollTop >= (panelTop - panelHeight / 3)) {
                current = panel.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });
});
