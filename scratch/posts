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
                loadContent('talks.html'); // Reload main blog container page
            });

        } catch (error) {
            console.error('Error opening full post:', error);
            rightColumn.innerHTML = `<p><small style="color: #ff6b6b;">Unable to load full post content (${error.message})</small></p>`;
        }
    }
