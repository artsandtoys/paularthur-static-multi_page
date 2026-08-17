/**
     * Removes existing images or videos from the lightbox overlay to prevent overlap.
     * @param {HTMLElement} popup - The lightbox DOM element.
     */
    function clearMedia(popup) {
        popup.querySelectorAll('img, video').forEach(el => {
            if (el.tagName && el.tagName.toLowerCase() === 'video') {
                try { el.pause(); } catch (err) {}
                el.removeAttribute('src');
            }
            el.remove();
        });
    }

    /**
     * Injects an image or video into the overlay based on index.
     */
    function showMedia(popup, prevBtn, nextBtn, index) {
        clearMedia(popup);
        const src = currentGallery[index];
        if (!src) return;

        // Check if file extension matches video formats
        const isVideo = src.match(/\.(mp4|webm)(\?.*)?$/i);
        const insertionPoint = nextBtn; 

        if (isVideo) {
            // Build and insert video element
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            popup.insertBefore(video, insertionPoint);

            video.play().catch(err => console.warn('Autoplay prevented:', err));
        } else {
            // Build and insert image element
            const img = document.createElement('img');
            img.src = src;
            img.alt = 'Gallery image';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            popup.insertBefore(img, insertionPoint);
        }
        
        currentIndex = index;
    }
    
    /**
     * Finds all elements with .gallery-trigger class and attaches overlay event listeners.
     */
    function attachGalleryTriggers() {
        const popup = document.querySelector('#columnPopup'); 
        if (!popup) return;

        const prevBtn = popup.querySelector('#prevBtn');
        const nextBtn = popup.querySelector('#nextBtn');

        // Attach click listeners to all gallery trigger items
        document.querySelectorAll('.gallery-trigger').forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                // Extract comma-separated image URLs from data-images attribute
                currentGallery = e.currentTarget.dataset.images.split(',').map(x => x.trim()).filter(x => x.length);
                currentIndex = 0;
                showMedia(popup, prevBtn, nextBtn, currentIndex);
                popup.style.display = 'flex';
            };
        });
        
        // Next button click handler (cycles forward)
        nextBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (!currentGallery.length) return;
            currentIndex = (currentIndex + 1) % currentGallery.length; 
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        // Previous button click handler (cycles backward)
        prevBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (!currentGallery.length) return;
            currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; 
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        // Close overlay when backdrop (outside content) is clicked
        popup.onclick = (e) => {
            if (e.target === popup) {
                popup.style.display = 'none';
                clearMedia(popup); 
            }
        };

        // Add keyboard keydown listener once globally
        if (!keyboardListenerAdded) {
            document.addEventListener('keydown', keyboardHandler);
            keyboardListenerAdded = true;
        }
    }
    
    /**
     * Keyboard navigation handler for lightbox overlay (Arrow keys & Escape).
     */
    function keyboardHandler(e) {
        const popup = document.querySelector('#columnPopup'); 
        
        if (popup && popup.style.display === 'flex') {
            const prevBtn = popup.querySelector('#prevBtn');
            const nextBtn = popup.querySelector('#nextBtn');
            
            if (e.key === 'Escape') popup.click(); 
            if (e.key === 'ArrowRight' && nextBtn) nextBtn.click();
            if (e.key === 'ArrowLeft' && prevBtn) prevBtn.click();
        }
    }

// Bind navigation click handlers to sidebar menu links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const contentFile = this.getAttribute('data-content-file');
            if (contentFile) {
                window.location.hash = ''; // Clear hash when clicking main navigation links
                loadContent(contentFile);
                removeActiveClasses();
                this.classList.add('active');
            }
        });
    });
    
    // Initialize gallery triggers on page startup
    attachGalleryTriggers();
    
    /**
     * Handles deep links directly loaded via URL hash (e.g., #post?id=post1.json).
     */
    function handleHashNavigation() {
        if (window.location.hash.startsWith('#post?id=')) {
            const filename = window.location.hash.replace('#post?id=', '');
            if (filename) {
                hideDefaultContent();
                openPostView(filename);
            }
        }
    }

    // Check URL hash on initial page load
    handleHashNavigation();

    // Re-check URL hash when browser back/forward navigation buttons are used
    window.addEventListener('hashchange', handleHashNavigation);

    // Disable right-click context menu site-wide
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        alert("Right-click is disabled on this page.");
    });
});

/**
 * Opens simple full-screen lightbox overlay for a single media element.
 * @param {HTMLElement} element - Target grid container or media node clicked.
 */
function openLightbox(element) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');

    // Resolve target media node and grab data-full-src path
    const target = element.querySelector ? (element.querySelector('img, video') || element) : element;
    const fullSrc = target.getAttribute('data-full-src');
    
    if (!fullSrc) {
        console.error('Media element missing data-full-src attribute.');
        return;
    }

    lightboxImage.src = fullSrc;
    lightbox.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; // Disable page scrolling while lightbox is active
}

/**
 * Closes simple standalone lightbox overlay and resets image source.
 */
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
    document.body.style.overflow = ''; // Re-enable background scrolling
    document.getElementById('lightbox-image').src = '';
}
