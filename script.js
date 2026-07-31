document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------
    // 1. GLOBAL ELEMENT SELECTORS
    // -----------------------------------------------------------------

    const rightColumn = document.querySelector('.right-column-wrapper');
    const navLinks = document.querySelectorAll('.left-content nav a.nav-link');
    
    // Selectors for elements that might be hidden when dynamic content loads
    const defaultSplash = document.getElementById('splash-content'); 
    const staticFooter = document.getElementById('static-footer');   
    
    // GALLERY STATE VARIABLES
    let currentGallery = [];
    let currentIndex = 0;
    let keyboardListenerAdded = false;

    // -----------------------------------------------------------------
    // 2. CORE UTILITY FUNCTIONS
    // -----------------------------------------------------------------

    function removeActiveClasses() {
        navLinks.forEach(link => link.classList.remove('active'));
    }

    function hideDefaultContent() {
        if (defaultSplash) defaultSplash.style.display = 'none';
        if (staticFooter) staticFooter.style.display = 'none';
        
        rightColumn.innerHTML = ''; 
    }

    // Helper function to fetch & populate posts when blog.html loads
    async function populateBlogPosts() {
        const container = document.getElementById('blog-posts-container');
        if (!container) return;

        try {
            const response = await fetch('posts.json');
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const posts = await response.json();
            container.innerHTML = ''; // Clear "Loading more..." text

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.style.marginBottom = '30px';

                postElement.innerHTML = `
                    <h3 style="margin-bottom: 5px;"><b style="color: Aqua;">${post.title}</b></h3>
                    <p><small style="color: #aaa;">${post.date}</small></p>
                    <p style="color: #ddd;">${post.content}</p>
                    <br>
                `;

                container.appendChild(postElement);
            });
        } catch (error) {
            console.error('Error fetching blog posts:', error);
            container.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load posts (${error.message})</small></p>`;
        }
    }

    async function loadContent(fileName) {
        hideDefaultContent(); 
        
        try {
            const response = await fetch(fileName);
            if (!response.ok) {
                throw new Error(`Failed to load content file: ${fileName}`);
            }
            const htmlContent = await response.text();

            rightColumn.innerHTML = htmlContent;
            window.scrollTo(0, 0); 

            // If we just loaded blog.html, fetch & render posts.json
            if (fileName === 'blog.html' || document.getElementById('blog-posts-container')) {
                await populateBlogPosts();
            }

            // Re-attach gallery triggers for dynamically loaded content
            attachGalleryTriggers(); 

        } catch (error) {
            console.error('Content loading error:', error);
            rightColumn.innerHTML = `<h2>Error</h2><p>Could not load content for ${fileName}. Please ensure <code>${fileName}</code> exists in the same directory.</p>`;
        }
    }

    // -----------------------------------------------------------------
    // 3. GALLERY / POP-UP LOGIC (#columnPopup)
    // -----------------------------------------------------------------

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
            video.style.maxHeight = '100%';
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
            img.style.maxHeight = '100%';
            popup.insertBefore(img, insertionPoint);
        }
        
        currentIndex = index;
    }
    
    function attachGalleryTriggers() {
        const popup = document.querySelector('#columnPopup'); 
        if (!popup) return;

        const prevBtn = popup.querySelector('#prevBtn');
        const nextBtn = popup.querySelector('#nextBtn');
        
        const galleryTriggerHandler = function(e) {
            e.preventDefault();
            
            currentGallery = e.currentTarget.dataset.images.split(',').map(x => x.trim()).filter(x => x.length);
            currentIndex = 0;
            
            showMedia(popup, prevBtn, nextBtn, currentIndex);
            popup.style.display = 'flex';
        };

        document.querySelectorAll('.gallery-trigger').forEach(item => {
            item.removeEventListener('click', galleryTriggerHandler); 
            item.addEventListener('click', galleryTriggerHandler);
        });
        
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

        popup.onclick = (e) => {
            if (e.target === popup) {
                popup.style.display = 'none';
                const vid = popup.querySelector('video');
                if (vid) vid.pause();
                clearMedia(popup); 
            }
        };

        if (!keyboardListenerAdded) {
            document.addEventListener('keydown', keyboardHandler);
            keyboardListenerAdded = true;
        }
    }
    
    function keyboardHandler(e) {
        const popup = document.querySelector('#columnPopup'); 
        
        if (popup && popup.style.display === 'flex') {
            const prevBtn = popup.querySelector('#prevBtn');
            const nextBtn = popup.querySelector('#nextBtn');
            
            if (e.key === 'Escape') {
                popup.click(); 
            }
            if (e.key === 'ArrowRight' && nextBtn) nextBtn.click();
            if (e.key === 'ArrowLeft' && prevBtn) prevBtn.click();
        }
    }

    // -----------------------------------------------------------------
    // 4. EVENT ATTACHMENT / INITIALIZATION
    // -----------------------------------------------------------------

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
    
    attachGalleryTriggers();
    
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        alert("Right-click is disabled on this page.");
    });
});

// =================================================================
// SECONDARY LIGHTBOX FUNCTIONS (FOR SNAPS GRID CONTENT)
// =================================================================

function openLightbox(element) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');

    const target = element.querySelector ? (element.querySelector('img, video') || element) : element;
    const fullSrc = target.getAttribute('data-full-src');
    
    if (!fullSrc) {
        console.error('Media element missing data-full-src attribute.');
        return;
    }

    lightboxImage.src = fullSrc;
    lightbox.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('lightbox-image').src = '';
}
