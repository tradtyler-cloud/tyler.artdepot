:root {
    --bg-color: #ffffff;
    --text-color: #000000;
    --border-color: #000000;
    --sidebar-width: 240px;
    --mobile-nav: 60px;
    
    /* Adjusted Fluid Typography: Smaller minimums for mobile */
    --h1-size: clamp(1.8rem, 8vw, 5rem);
    --h2-size: clamp(1.4rem, 6vw, 3rem);
    --nav-size: clamp(0.75rem, 1vw, 1rem);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: 'Courier New', Courier, monospace;
    text-transform: uppercase;
}

/* Sidebar Navigation (Desktop) */
.sidebar {
    position: fixed;
    left: 0; top: 0; height: 100vh;
    width: var(--sidebar-width);
    border-right: 1px solid var(--border-color);
    padding: 40px;
    background: var(--bg-color);
    z-index: 1000;
}

.nav-links { list-style: none; margin-top: 60px; }
.nav-links li { margin-bottom: 25px; }
.nav-links a {
    color: var(--text-color);
    text-decoration: none;
    font-size: var(--nav-size);
    font-weight: 900;
}

/* Stack Container */
.stack-container { margin-left: var(--sidebar-width); }

.panel {
    position: sticky;
    top: 0;
    height: 100vh;
    width: calc(100vw - var(--sidebar-width));
    background: var(--bg-color);
    border-top: 1px solid var(--border-color);
    padding: 8vw;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

h1 { font-size: var(--h1-size); line-height: 1.1; margin-bottom: 1.5rem; }
h2 { font-size: var(--h2-size); margin-bottom: 1rem; }

.bio-text {
    line-height: 1.6;
    max-width: 600px;
    text-transform: none;
}

/* Art Grid */
.art-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.art-item img { width: 100%; border: 1px solid var(--border-color); }

/* --- MOBILE OPTIMIZATION --- */
@media (max-width: 768px) {
    .sidebar {
        width: 100%; height: var(--mobile-nav);
        flex-direction: row; border-right: none;
        border-bottom: 1px solid var(--border-color);
        padding: 0 20px; align-items: center; justify-content: space-between;
    }
    .nav-links { display: flex; margin-top: 0; gap: 15px; }
    .stack-container { margin-left: 0; margin-top: var(--mobile-nav); }

    .panel {
        width: 100vw;
        position: relative; /* Disables sticky for mobile */
        height: auto;       /* Allows panel to be only as big as the content */
        min-height: 40vh;   /* Sets a comfortable minimum without blowing up the screen */
        padding: 40px 20px;
        border-bottom: 1px solid var(--border-color); /* Separator lines for mobile */
    }

    .art-grid { grid-template-columns: 1fr; }
    
    /* Make images slightly smaller on mobile to prevent "blowing up" */
    .art-item { max-width: 90%; margin: 0 auto; } 
}

/* Animation Reveal */
.scroll-reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.8s ease-out;
}
.scroll-reveal.visible { opacity: 1; transform: translateY(0); }
