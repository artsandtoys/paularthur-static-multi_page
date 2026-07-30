
let allPosts = [];

async function loadBlogPosts() {
  const container = document.getElementById('blog-posts-container');
  
  try {
    const response = await fetch('posts.json');
    allPosts = await response.json();

    container.innerHTML = '';

    allPosts.forEach((post, index) => {
      const card = document.createElement('article');
      card.className = 'post-card';
      
      card.innerHTML = `
        <h3 class="post-title">${post.title}</h3>
        <div class="post-date">${post.date}</div>
        <p class="post-summary">${post.summary}</p>
        <button class="read-more-btn" onclick="openModal(${index})">Read Full Post</button>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    container.innerHTML = '<p>Unable to load posts right now.</p>';
  }
}

function openModal(index) {
  const post = allPosts[index];
  document.getElementById('modal-title').innerText = post.title;
  document.getElementById('modal-date').innerText = post.date;
  document.getElementById('modal-body').innerHTML = post.content;
  
  document.getElementById('post-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('post-modal').style.display = 'none';
}

window.onclick = function(event) {
  const modal = document.getElementById('post-modal');
  if (event.target === modal) {
    closeModal();
  }
};

document.addEventListener('DOMContentLoaded', loadBlogPosts);
