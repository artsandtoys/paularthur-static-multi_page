// DOM (Document Object Model) 
document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // SECTION 1: GLOBAL ELEMENT SELECTORS
    // Finds and stores the main layout components from your HTML page.
    // =================================================================

    // Main content area where dynamic views (blog posts, pages) are loaded
    const rightColumn = document.querySelector('.right-column-wrapper');
    
    // Left sidebar navigation links
    const navLinks = document.querySelectorAll('.left-content nav a.nav-link');
    
    // Default splash screen and footer elements that hide when dynamic content loads
    const defaultSplash = document.getElementById('splash-content'); 
    const staticFooter = document.getElementById('static-footer');   
    
    // Global state variables for the primary pop-up lightbox gallery (#columnPopup)
    let currentGallery = [];           // Array of media URLs for the active gallery
    let currentIndex = 0;              // Currently displayed image/video index
    let keyboardListenerAdded = false; // Flag to prevent duplicate keydown listeners


    // =================================================================
    // SECTION 2: HYBRID BLOG ENGINE (JSON + RSS)
    // Reads local JSON posts via manifest.json AND 
    // pulls external RSS feeds (Substack/Medium), 
    // merging and sorting them chronologically.
    // =================================================================

    // Global configuration object for the blog system
    const BLOG_CONFIG = {
        // combines JSON & RSS
        mode: 'both', 

        // URL of Substack or Medium RSS feed
        rssLink: 'https://paularthur.substack.com/feed', 

        // rss2json.com
        // API proxy that converts raw RSS XML into JSON format on-the-fly
        rssApiEndpoint: 'https://api.rss2json.com/v1/api.json?rss_url='
    };

    /**
     * Master controller for loading, merging, and rendering blog posts.
     */
    async function populateBlogPosts() {
        // Locate the target container in the HTML layout
        const container = document.getElementById('blog-posts-container');
        if (!container) return; // Exit gracefully if not on the blog view page

        try {
            // list local var 
            let jsonPosts = [];
            let rssPosts = [];

            // --- FETCH STEP 1: Load Local JSON Posts (if enabled) ---
            if (BLOG_CONFIG.mode === 'both' || BLOG_CONFIG.mode === 'json') {
                jsonPosts = await fetchLocalJsonPosts().catch(err => {
                    console.warn('Failed to fetch local JSON posts:', err);
                    return []; // Return empty array on failure so RSS still works
                });
            }

            // --- FETCH STEP 2: Load External RSS Feed Posts (if enabled) ---
            if (BLOG_CONFIG.mode === 'both' || BLOG_CONFIG.mode === 'rss') {
                rssPosts = await fetchRssPosts(BLOG_CONFIG.rssLink).catch(err => {
                    console.warn('Failed to fetch RSS posts:', err);
                    return []; // Return empty array on failure so JSON still works
                });
            }

            // MERGE & SORT STEP: Combine both streams into a single list 
            const combinedPosts = [...jsonPosts, ...rssPosts];

            // Sort posts chronologically: newest publication dates appear first
            combinedPosts.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

            // Clear initial "Loading..."
            container.innerHTML = ''; 

            // Display message if no posts were retrieved from either source
            if (combinedPosts.length === 0) {
                container.innerHTML = '<p><small style="color: #aaa;">No posts available.</small></p>';
                return;
            }

            // --- RENDER STEP: Loop through combined posts and create DOM elements ---
            combinedPosts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.style.marginBottom = '30px';

                // Determine whether to link externally (RSS) or navigate locally via hash (JSON)
                const readMoreButton = post.isExternal
                    ? `<a href="${post.url}" target="_blank" rel="noopener noreferrer" class="read-more-btn" style="color: #0bf9ea; text-decoration: underline; cursor: pointer;">read post...</a>`
                    : `<a href="#post?id=${post.filename}" class="read-more-btn" data-filename="${post.filename}" style="color: #b3ff00; text-decoration: underline; cursor: pointer;">read more...</a>`;

                // Build HTML layout for each post card
                postElement.innerHTML = `
                    <h4 style="margin-bottom: 5px; color: white !important;"><b style="color: white !important;">${post.title}</b></h4>
                    <p><span style="color: #aaa;">${post.dateFormatted}</span></p>
                    <div style="color: #ddd;">
                        ${post.summary || post.content}
                        ${(post.hasMore || post.isExternal) ? `
                            <br><br>
                            ${readMoreButton}
                        ` : ''}
                    </div>
                    <br>
                `;

                // Attach click event listener to local JSON posts to open full post view
                if (!post.isExternal && post.hasMore) {
                    const btn = postElement.querySelector('.read-more-btn');
                    btn?.addEventListener('click', (e) => {
                        e.preventDefault();
                        openPostView(post.filename);
                    });
                }

                // Append finalized post element to the page container
                container.appendChild(postElement);
            });

        } catch (error) {
            console.error('Error fetching blog posts:', error);
            container.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load posts (${error.message})</small></p>`;
        }
    }

    /**
     * Local JSON Fetcher: Reads ./posts/manifest.json, then fetches each individual JSON post file.
     */
    async function fetchLocalJsonPosts() {
        // Step A: Request the manifest array
        const manifestResponse = await fetch('./posts/manifest.json');
        if (!manifestResponse.ok) throw new Error(`HTTP Error ${manifestResponse.status}`);
        
        const postFiles = await manifestResponse.json();
        if (!Array.isArray(postFiles)) return [];

        // Step B: Fetch all individual post files concurrently
        const postPromises = postFiles.map(file => 
            fetch(`./posts/${file}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (!data) return null;
                    const parsedDate = new Date(data.date);
                    
                    // Normalize JSON data structure to match unified schema
                    return { 
                        filename: file, 
                        title: data.title,
                        rawDate: isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate,
                        dateFormatted: data.date,
                        summary: data.summary,
                        content: data.content,
                        hasMore: Boolean(data.content && data.content.trim().length > 0),
                        isExternal: false 
                    };
                })
                .catch(() => null) // Ignore bad files without breaking the whole loop
        );

        // Wait for all promises to settle and filter out failed requests (nulls)
        const rawPosts = await Promise.all(postPromises);
        return rawPosts.filter(Boolean);
    }

    /**
     * RSS Fetcher: Calls the rss2json service API to pull and convert RSS XML into JSON.
     */
    async function fetchRssPosts(rssLink) {
        const apiUrl = `${BLOG_CONFIG.rssApiEndpoint}${encodeURIComponent(rssLink)}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

        const data = await response.json();
        if (!data.items) return [];

        // Normalize RSS data structure to match unified schema
        return data.items.map(item => {
            const parsedDate = new Date(item.pubDate);
            return {
                title: item.title,
                rawDate: isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate,
                dateFormatted: parsedDate.toLocaleDateString(),
                summary: item.description,
                content: item.content || item.description,
                url: item.link,
                isExternal: true
            };
        });
    }

    /**
     * Loads and renders a dedicated full-page view for local JSON blog posts.
     * @param {string} filename - The json filename inside /posts/ directory.
     */
    async function openPostView(filename) {
        if (!rightColumn) return;

        // Set URL hash for direct bookmarking or sharing
        window.location.hash = `post?id=${filename}`;

        try {
            // Fetch target post file
            const res = await fetch(`./posts/${filename}`);
            if (!res.ok) throw new Error(`Failed to fetch post: ${filename}`);
            const post = await res.json();

            // Scroll view back to top
            window.scrollTo(0, 0);

            // Render full post layout into the main right-column area
            rightColumn.innerHTML = `
                <section class="content-section">
                    <p><span style="color: #aaa;">${post.date}</span></p>
                    <h2 style="color: white !important;"><b style="color: white !important;">${post.title}</b></h2>
                    <div style="color: #ddd; line-height: 1.5;">
                        ${post.summary ? `<p>${post.summary}</p>` : ''}
                        <p>${post.content}</p>
                    </div>
                    <br>
                    <a href="#" id="back-to-blog" style="color: #b3ff00; text-decoration: underline; cursor: pointer;">back</a>
                </section>
            `;

            // Bind click handler for "back to blog" link
            document.getElementById('back-to-blog').addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = ''; // Clear URL hash
                loadContent('tales.html'); // Reload main blog container page
            });

        } catch (error) {
            console.error('Error opening full post:', error);
            rightColumn.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load full post content (${error.message})</small></p>`;
        }
    }


    // =================================================================
    // SECTION 3: PAGE ROUTING / CONTENT LOADING (SPA SYSTEM)
    // Loads sub-pages dynamically (tales.html, music.html, etc.) via AJAX 
    // without performing a full browser page refresh.
    // =================================================================

    /**
     * Removes active class highlighting from all navigation links.
     */
    function removeActiveClasses() {
        navLinks.forEach(link => link.classList.remove('active'));
    }

    /**
     * Clears landing elements and right column before injecting new content.
     */
    function hideDefaultContent() {
        if (defaultSplash) defaultSplash.style.display = 'none';
        if (staticFooter) staticFooter.style.display = 'none';
        rightColumn.innerHTML = ''; 
    }

    /**
     * Fetches HTML content dynamically and injects it into .right-column-wrapper.
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

            // Inject retrieved HTML into the right column
            rightColumn.innerHTML = htmlContent;
            window.scrollTo(0, 0); 

            // Trigger blog engine if the loaded file is the blog view
            if (fileName === 'tales.html' || document.getElementById('blog-posts-container')) {
                await populateBlogPosts();
            }

            // Re-bind pop-up lightbox gallery listeners to newly injected content
            attachGalleryTriggers(); 

        } catch (error) {
            console.error('Content loading error:', error);
            rightColumn.innerHTML = `<h2>Error</h2><p>Could not load content for ${fileName}. Please ensure <code>${fileName}</code> exists in the same directory.</p>`;
        }
    }


    // =================================================================
    // SECTION 4: MAIN POP-UP LIGHTBOX GALLERY LOGIC (#columnPopup)
    // Manages interactive image/video overlays with arrow button and 
    // keyboard navigation.
    // =================================================================

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


    // =================================================================
    // SECTION 5: INITIALIZATION & ROUTING EVENT LISTENERS
    // Binds navigation menu links, direct URL hash routes, and right-click protection.
    // =================================================================

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


// =================================================================
// SECTION 6: SECONDARY LIGHTBOX (STANDALONE PHOTO GRID CONTENT)
// Simple standalone full-screen lightbox for photo elements outside #columnPopup.
// =================================================================

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
