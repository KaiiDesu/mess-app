function filterChats(query) {
  const items = document.querySelectorAll('#chat-list .chat-item');
  items.forEach(item => {
    const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
    item.style.display = name.includes(query.toLowerCase()) ? '' : 'none';
  });
}

function searchFriends(query) {
  if (typeof window.searchFriendUsers === 'function') {
    return window.searchFriendUsers(query);
  }
}
