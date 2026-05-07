// Smooth Scrolling for Internal Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

function setGalleryStatus(el, text, isError) {
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('is-error', Boolean(isError));
}

async function initInstagramGallery() {
    const grid = document.getElementById('ig-gallery');
    const statusEl = document.getElementById('ig-gallery-status');
    if (!grid || !statusEl) return;

    let data;
    try {
        const res = await fetch('data/gallery.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch {
        if (location.protocol === 'file:') {
            setGalleryStatus(
                statusEl,
                'Gallery needs an HTTP URL: run npm run serve (double-clicking index.html cannot load data/gallery.json).',
                true
            );
        } else {
            setGalleryStatus(statusEl, 'Could not load gallery data.', true);
        }
        return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
        setGalleryStatus(
            statusEl,
            'No synced posts yet. Run npm run sync:instagram after adding token + user id to .env.',
            false
        );
        return;
    }

    statusEl.hidden = true;
    const frag = document.createDocumentFragment();

    for (const item of items) {
        const src = item.displayUrl || item.mediaUrl;
        if (!src) continue;

        const wrap = document.createElement('div');
        wrap.className = 'art-item';

        const link = document.createElement('a');
        link.href = item.permalink || src;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const img = document.createElement('img');
        img.src = src;
        const cap = typeof item.caption === 'string' ? item.caption : '';
        img.alt = cap ? cap.slice(0, 120) : 'Instagram post';

        link.appendChild(img);
        wrap.appendChild(link);
        frag.appendChild(wrap);
    }

    grid.appendChild(frag);
}

document.addEventListener('DOMContentLoaded', initInstagramGallery);

console.log("System Status: Visual_Archive_Online");