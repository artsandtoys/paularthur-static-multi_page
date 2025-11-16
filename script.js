// script for js
document.addEventListener('DOMContentLoaded', () => {

    const rightColumn = document.querySelector('.right-column-wrapper');
    const navLinks = document.querySelectorAll('.left-content nav a.nav-link');
    // Get the static content and footer elements
    const defaultSplash = document.getElementById('splash-content'); 
    const staticFooter = document.getElementById('static-footer');
    
    // --- UTILITY FUNCTIONS ---
    function removeActiveClasses() {
        navLinks.forEach(link => link.classList.remove('active'));
    }

    // Function to hide the static content when a link is clicked
    function hideDefaultContent() {
        if (defaultSplash) defaultSplash.style.display = 'none';
        if (staticFooter) staticFooter.style.display = 'none'; 
        // Clear any content that might have been loaded dynamically previously
        // We use innerHTML = '' on the rightColumn before insertion, but this ensures safety
        rightColumn.innerHTML = ''; 
    }

    // Function to load content dynamically via fetch
    async function loadContent(fileName) {
        // 1. Hide the static splash content before loading new content
        hideDefaultContent(); 
        
        try {
            const response = await fetch(fileName);
            if (!response.ok) {
                throw new Error(`Failed to load content file: ${fileName}`);
            }
            const htmlContent = await response.text();

            // 2. Insert new HTML
            rightColumn.innerHTML = htmlContent;
            window.scrollTo(0, 0); 

            // 3. Re-attach event listeners (especially for the gallery)
            attachGalleryTriggers(); 

        } catch (error) {
            console.error('Content loading error:', error);
            rightColumn.innerHTML = `<h2>Error</h2><p>Could not load content for ${fileName}. Please ensure <code>${fileName}</code> exists in the same directory.</p>`;
        }
    }

    // --- NAV LINK CLICK HANDLER ---
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const contentFile = this.getAttribute('data-content-file');
            if (contentFile) {
                loadContent(contentFile);
                
                removeActiveClasses();
                this.classList.add('active');
            }
        });
    });

    // GALLERY POPUP LOGIC (Requires works.html to be loaded) 
    let currentGallery = [];
    let currentIndex = 0;
    let keyboardListenerAdded = false; 

    function clearMedia(popup) {
        popup.querySelectorAll('img, video').forEach(el => {
            if (el.tagName && el.tagName.toLowerCase() === 'video') {
                try { el.pause(); } catch (err) {}
                el.removeAttribute('src');
            }
            el.remove();
        });
    }

    function showMedia(popup, prevBtn, nextBtn, index) {
        clearMedia(popup);
        const src = currentGallery[index];
        if (!src) return;

        const isVideo = src.match(/\.(mp4|webm)(\?.*)?$/i);
        const insertionPoint = nextBtn; 

        if (isVideo) {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.style.maxWidth = '100%';
            video.maxHeight = '100%';
            video.setAttribute('aria-label', 'Gallery video');
            popup.insertBefore(video, insertionPoint);

            video.addEventListener('error', (ev) => console.warn('Video error', ev));
            video.play().catch(err => {
                console.warn('Play promise rejected:', err);
            });
        } else {
            const img = document.createElement('img');
            img.src = src;
            img.alt = 'Gallery image';
            img.style.maxWidth = '100%';
            img.maxHeight = '100%';
            popup.insertBefore(img, insertionPoint);
        }
    }
    
    // Attaches all gallery-related events after new content is loaded
    function attachGalleryTriggers() {
        // The popup element is loaded inside works.html, so we query the main column wrapper
        // The popup itself must be an ID, so we look for it in the newly loaded content
        const popup = rightColumn.querySelector('#columnPopup');
        if (!popup) return;

        const prevBtn = popup.querySelector('#prevBtn');
        const nextBtn = popup.querySelector('#nextBtn');
        
        // Define trigger handler
        const galleryTriggerHandler = function(e) {
             e.preventDefault();
             // The gallery must be attached to the main body's event listener for key presses to work
             currentGallery = e.currentTarget.dataset.images.split(',').map(x => x.trim()).filter(x => x.length);
             currentIndex = 0;
             showMedia(popup, prevBtn, nextBtn, currentIndex);
             popup.style.display = 'flex';
        };

        // Targets gallery triggers in the currently loaded content
        rightColumn.querySelectorAll('.gallery-trigger').forEach(item => {
            item.removeEventListener('click', galleryTriggerHandler);
            item.addEventListener('click', galleryTriggerHandler);
        });
        
        // ATTACH NAV BUTTON EVENTS
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            if (!currentGallery.length) return;
            currentIndex = (currentIndex + 1) % currentGallery.length;
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        prevBtn.onclick = (e) => {
            e.stopPropagation();
            if (!currentGallery.length) return;
            currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        // ATTACH CLOSE EVENT (Only on background click)
        popup.onclick = (e) => {
            if (e.target === popup) {
                popup.style.display = 'none';
                const vid = popup.querySelector('video');
                if (vid) vid.pause();
                clearMedia(popup); 
            }
        };

        // ATTACH KEYBOARD EVENTS (Add only once to the document)
        if (!keyboardListenerAdded) {
            document.addEventListener('keydown', keyboardHandler);
            keyboardListenerAdded = true;
        }
    }
    
    // KeyDown Handler Definition
    function keyboardHandler(e) {
        // Since the popup element is dynamically loaded, we must query the main document for its existence
        const popup = document.querySelector('#columnPopup'); 
        
        if (popup && popup.style.display === 'flex') {
            const prevBtn = popup.querySelector('#prevBtn');
            const nextBtn = popup.querySelector('#nextBtn');
            
            if (e.key === 'Escape') {
                popup.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (err) {} });
                popup.style.display = 'none';
                clearMedia(popup);
            }
            if (e.key === 'ArrowRight' && nextBtn) nextBtn.click();
            if (e.key === 'ArrowLeft' && prevBtn) prevBtn.click();
        }
    }
    
    // --- Disable right-click on the entire page --- 
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        alert("Right-click is disabled on this page.");
    });
});

