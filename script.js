document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // SECTION 1: GLOBAL ELEMENT SELECTORS
    // Finds and stores the main layout components from your HTML page.
    // =================================================================

    const rightColumn = document.querySelector('.right-column-wrapper');
    const navLinks = document.querySelectorAll('.left-content nav a.nav-link');
    
    // Selectors for elements that might be hidden when dynamic content loads
    const defaultSplash = document.getElementById('splash-content'); 
    const staticFooter = document.getElementById('static-footer');   
    
    // Gallery state variables (tracks images, videos, and navigation index)
    let currentGallery = [];
    let currentIndex = 0;
    let keyboardListenerAdded = false;


    // =================================================================
    // SECTION 2: BLOG SYSTEM LOGIC
    // Reads ./posts/manifest.json, loads individual post JSON files, and 
    // handles full post views on "read more..." click.
    // =================================================================

    /**
     * Fetches post filenames from manifest.json and loads each post JSON file.
     * Renders summaries and adds "read more..." buttons for full view.
     */
    async function populateBlogPosts() {
        const container = document.getElementById('blog-posts-container');
        if (!container) return; // Exit if the blog container doesn't exist on screen

        try {
            // STEP A: Fetch the manifest from ./posts/manifest.json
            const manifestResponse = await fetch('./posts/manifest.json');
            if (!manifestResponse.ok) throw new Error(`HTTP Error ${manifestResponse.status}`);
            
            const postFiles = await manifestResponse.json();
            
            if (!Array.isArray(postFiles) || postFiles.length === 0) {
                container.innerHTML = '<p><small style="color: #aaa;">No posts found.</small></p>';
                return;
            }

            // STEP B: Fetch all individual post files concurrently
            const postPromises = postFiles.map(file => 
                fetch(`./posts/${file}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Failed to load posts/${file}`);
                        return res.json();
                    })
                    .then(data => ({ filename: file, ...data }))
            );

            const posts = await Promise.all(postPromises);
            container.innerHTML = ''; // Clear "Loading..." text

            // STEP C: Render each post snippet into the DOM
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.style.marginBottom = '30px';

                const hasMore = Boolean(post.content && post.content.trim().length > 0);

                // BLOG POST
                postElement.innerHTML = `
                    <p><small style="color: #aaa;">${post.date}</small></p>
                    <h3 style="margin-bottom: 5px; color: white !important;"><b style="color: white !important;">${post.title}</b></h3>
                    <p style="color: #ddd;">
                        ${post.summary || post.content}
                        ${hasMore ? `
                            <br><br>
                            <a href="#post?id=${post.filename}" class="read-more-btn" data-filename="${post.filename}" style="color: #b3ff00; text-decoration: underline; cursor: pointer;">read more...</a>
                        ` : ''}
                    </p>
                    <br>
                `;

                // STEP D: Attach event listener to open full post page view
                if (hasMore) {
                    const btn = postElement.querySelector('.read-more-btn');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        openPostView(post.filename);
                    });
                }

                container.appendChild(postElement);
            });

        } catch (error) {
            console.error('Error fetching blog posts:', error);
            container.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load posts (${error.message})</small></p>`;
        }
    }

    /**
     * Fetches and displays a full post on a dedicated view page.
     * @param {string} filename - The json filename inside /posts/
     */
    async function openPostView(filename) {
        if (!rightColumn) return;

        // Update URL hash for direct linking/sharing
        window.location.hash = `post?id=${filename}`;

        try {
            const res = await fetch(`./posts/${filename}`);
            if (!res.ok) throw new Error(`Failed to fetch post: ${filename}`);
            const post = await res.json();

            window.scrollTo(0, 0);

            // BLOG POST
            rightColumn.innerHTML = `
                <section class="content-section">
                    <p><small style="color: #aaa;">${post.date}</small></p>
                    <h2 style="color: white !important;"><b style="color: white !important;">${post.title}</b></h2>
                    <div style="color: #ddd; line-height: 1.5;">
                        ${post.summary ? `<p>${post.summary}</p>` : ''}
                        <p>${post.content}</p>
                    </div>
                    <a href="#" id="back-to-blog" style="color: #b3ff00; text-decoration: underline; cursor: pointer;">&#10094; back to blog</a>
                </section>
            `;

            // "Back to blog" button event
            document.getElementById('back-to-blog').addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = ''; // Clear hash
                loadContent('words.html');
            });

        } catch (error) {
            console.error('Error opening full post:', error);
            rightColumn.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load full post content (${error.message})</small></p>`;
        }
    }


    // =================================================================
    // SECTION 3: PAGE ROUTING / CONTENT LOADING (SPA SYSTEM)
    // Fetches sub-pages (blog.html, music.html, etc.) via AJAX without refreshing.
    // =================================================================

    // Removes the active green color from navigation links
    function removeActiveClasses() {
        navLinks.forEach(link => link.classList.remove('active'));
    }

    // Clears out the right column before loading new section content
    function hideDefaultContent() {
        if (defaultSplash) defaultSplash.style.display = 'none';
        if (staticFooter) staticFooter.style.display = 'none';
        
        rightColumn.innerHTML = ''; 
    }

    /**
     * Loads dynamic HTML files (like intro.html, blog.html, music.html) into .right-column-wrapper
     * @param {string} fileName - The HTML snippet file to load.
     */
    async function loadContent(fileName) {
        hideDefaultContent(); 
        
        try {
            const response = await fetch(`./${fileName}`);
            if (!response.ok) {
                throw new Error(`Failed to load content file: ${fileName}`);
            }
            const htmlContent = await response.text();

            // Inject the new HTML content and scroll to top
            rightColumn.innerHTML = htmlContent;
            window.scrollTo(0, 0); 

            // IF BLOG HTML WAS LOADED: Trigger the blog fetch engine
            if (fileName === 'words.html' || document.getElementById('blog-posts-container')) {
                await populateBlogPosts();
            }

            // Re-attach pop-up gallery event listeners to any newly loaded items
            attachGalleryTriggers(); 

        } catch (error) {
            console.error('Content loading error:', error);
            rightColumn.innerHTML = `<h2>Error</h2><p>Could not load content for ${fileName}. Please ensure <code>${fileName}</code> exists in the same directory.</p>`;
        }
    }


    // =================================================================
    // SECTION 4: MAIN POP-UP GALLERY LOGIC (#columnPopup)
    // Handles overlay image/video preview popups and keyboard navigation.
    // =================================================================

    // Clears current image or video elements from the overlay
    function clearMedia(popup) {
        popup.querySelectorAll('img, video').forEach(el => {
            if (el.tagName && el.tagName.toLowerCase() === 'video') {
                try { el.pause(); } catch (err) {}
                el.removeAttribute('src');
            }
            el.remove();
        });
    }

    // Injects image or video into overlay based on current index
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
    
    // Binds click handlers to all .gallery-trigger elements in loaded pages
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
        
        // Next button handler
        nextBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (!currentGallery.length) return;
            currentIndex = (currentIndex + 1) % currentGallery.length; 
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        // Previous button handler
        prevBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (!currentGallery.length) return;
            currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; 
            showMedia(popup, prevBtn, nextBtn, currentIndex);
        };

        // Close popup when clicking backdrop
        popup.onclick = (e) => {
            if (e.target === popup) {
                popup.style.display = 'none';
                const vid = popup.querySelector('video');
                if (vid) vid.pause();
                clearMedia(popup); 
            }
        };

        // Bind Arrow keys and Escape key listener
        if (!keyboardListenerAdded) {
            document.addEventListener('keydown', keyboardHandler);
            keyboardListenerAdded = true;
        }
    }
    
    // Handles Escape key and Left/Right Arrow key navigation for galleries
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


    // =================================================================
    // SECTION 5: INITIALIZATION & NAVIGATION LISTENERS
    // Binds click handlers to left menu links, direct hashes, and right clicks.
    // =================================================================

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const contentFile = this.getAttribute('data-content-file');
            if (contentFile) {
                window.location.hash = ''; // Reset hash when navigating away
                loadContent(contentFile);
                removeActiveClasses();
                this.classList.add('active');
            }
        });
    });
    
    // Initialize gallery triggers for statically loaded content
    attachGalleryTriggers();
    
    // Handle direct URL hash loads (e.g., refreshing or directly visiting a post link)
    if (window.location.hash.startsWith('#post?id=')) {
        const filename = window.location.hash.replace('#post?id=', '');
        if (filename) {
            hideDefaultContent();
            openPostView(filename);
        }
    }

    // Disable right-click context menu site-wide
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        alert("Right-click is disabled on this page.");
    });
});


// =================================================================
// SECTION 6: SECONDARY LIGHTBOX (SNAPS / PHOTO GRID CONTENT)
// Simple full-screen image lightbox for photo grids outside #columnPopup.
// =================================================================

/**
 * Opens full-screen lightbox for single photo elements.
 * @param {HTMLElement} element - The grid item or media element clicked.
 */
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

/**
 * Closes simple full-screen lightbox.
 */
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('lightbox-image').src = '';
}
