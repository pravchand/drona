// Constants for page elements
let CURRENT_ROOM = 0
let CURRENT_ROOM_NAME = "room_name_placeholder"
const SUPPORTED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const AUTH_SECTION = document.getElementById('auth-section');
const MAIN_APP = document.getElementById('main-app');
const USER_PROFILE = document.getElementById('user-profile');
const mainContent = document.getElementById('main-content');
const replyThreads = document.getElementById('thread-replies');
const channelList = document.getElementById('sidebar');
const displayRoomName = document.querySelector('.displayRoomName');
const editRoomName = document.querySelector('.editRoomName');
const replyClose = document.getElementById('reply-close');
const currentUsername = document.getElementById('current-username');

// Helper functions for local storage
const getUsername = () => localStorage.getItem("username");
const setUsername = (username) => localStorage.setItem("username", username);
const clearUsername = () => localStorage.removeItem("username");
const getSessionCookie = () => localStorage.getItem("praveenc_cookie");
const setSessionCookie = (cookie) => localStorage.setItem("praveenc_cookie", cookie);
const clearSessionCookie = () => localStorage.removeItem("praveenc_cookie");



// Function to update username display
const updateUsernameDisplay = () => {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.textContent = getUsername();
        currentUsername.textContent = getUsername();
    }
};


// Function to check if user has valid credentials
const hasValidCredentials = () => {
    return getSessionCookie() !=null;
};

// Function to show only one section and hide others
const showOnly = (element) => {
    [AUTH_SECTION, MAIN_APP, USER_PROFILE].forEach(section => section.classList.add("hide"));
    element.classList.remove("hide");
    updateUsernameDisplay();
};

const roomNameDisplayer = () => {
  displayRoomName.style.display = 'block';
  editRoomName.style.display = 'none';

};

const roomNameEditor = () => {
  displayRoomName.style.display = 'none';
  editRoomName.style.display = 'block';
};

const removeHide = (element) => {
  element.classList.remove("hide");
};
const addHide = (element) => {
  element.classList.add("hide");
};

const highlightCurrentRoom = (CURRENT_ROOM) => {
  const channelItems = document.querySelectorAll('#channel-list li');
    
  // Remove any existing highlight
  channelItems.forEach(item => {
      item.classList.remove('current-room');
  });
  
  // Find and highlight the current room
  const currentRoomElement = Array.from(channelItems).find(item => 
      parseInt(item.dataset.roomId) === parseInt(CURRENT_ROOM)
  );
  
  if (currentRoomElement) {
      currentRoomElement.classList.add('current-room');
  }
};

// Routing logic
const router = () => {
    let path = window.location.pathname;
    if (path === "/") {
        hasValidCredentials() ? showOnly(MAIN_APP) : handleRedirectToLogin(path);
        if (hasValidCredentials()) {
            removeHide(channelList)
            getChannels();
        }
    } else if (path === "/profile") {
        hasValidCredentials() ? showOnly(USER_PROFILE) :  handleRedirectToLogin(path);
    } else if (path.startsWith("/channel/")) {
        if (hasValidCredentials()) {
            const channelId = path.split("/")[2];
            CURRENT_ROOM = channelId;
            highlightCurrentRoom(CURRENT_ROOM);
            getChannels();
            navigateToChannel(channelId);
        } else {
            handleRedirectToLogin(path);
        }
    } else if (path === "/login") {
      hasValidCredentials() ? showOnly(MAIN_APP) :  showOnly(AUTH_SECTION);
      if (hasValidCredentials()) {
        window.history.pushState({}, '', '/');
        removeHide(channelList)
        getChannels();
  }}
  else if (path.startsWith("/replies")) {
    if (hasValidCredentials()) {
      const urlParams = new URLSearchParams(window.location.search); 
      const channelId = urlParams.get('channelid'); 
      const currentMessageId = urlParams.get('currentmessage'); 
    console.log("here")
        showOnly(MAIN_APP)
        CURRENT_ROOM = channelId; 
        highlightCurrentRoom(CURRENT_ROOM); 
        getChannels(); 
        navigateToChannel(channelId); 
        openThread(currentMessageId); 
    } else {
        handleRedirectToLogin(path);
        console.log("Missing channelid or currentmessage query parameters.");
    }
  }
  else {
        console.log("Unknown path: " + path);
    }
};

// Handling login redirects- if user has some other path initially.
let handleRedirectToLogin = (currentPath) => {
  // Store the current path where the user tried to go
  localStorage.setItem('redirectAfterLogin', currentPath);
  window.history.pushState({}, '', '/login');
  showOnly(AUTH_SECTION);
};

let handleRedirectAfterLogin = () => {
  const redirectPath = localStorage.getItem('redirectAfterLogin');
  if (redirectPath) {
    localStorage.removeItem('redirectAfterLogin');
    // Update the URL to reflect the original path (without reload)
    window.history.pushState({}, '', redirectPath); 
    router();  
  } else {
    
    window.history.pushState({}, '', '/login'); 
    CURRENT_ROOM = 0;
    router();
  }
};

let onLoginSuccess = () => {
  handleRedirectAfterLogin();
};
// Function to handle login
const handleLogin = () => {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
  })
  .then(response => {
      if (!response.ok) {
          document.getElementById('auth-error').textContent = "Login failed. Please try again.";
          throw new Error("Login failed");  // Trigger the catch block
      }
      return response.json();  // Only proceed if response is OK
  })
  .then(data => {
      setSessionCookie(data.token);
      setUsername(username);
      onLoginSuccess();
      router();  // Navigate after successful login
  })
  .catch(() => {

  });
};

// Function to handle signup
const handleSignup = () => {
    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;

    fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
    .then(response => {
        if (!response.ok) throw new Error("Signup failed");
        return response.json();
    })
    .then(data => {
      console.log(data.token)
      setSessionCookie(data.token);
      console.log(data.token)
        setUsername(username);
        window.history.pushState({}, '', '/');
        CURRENT_ROOM = 0
        router();
    })
    .catch(() => {
        alert("Signup failed. Please try again.");
    });
};

// Function to handle logout
const handleLogout = () => {
    CURRENT_ROOM = 0
    clearUsername();
    clearSessionCookie();
    router();
};

// Function to get channels
const getChannels = () => {
    fetch("/api/channels", {
        headers: { "Authorization": getSessionCookie() }
    })
    .then(response => response.json())
    .then(channels => {
        const channelList = document.getElementById('channel-list');
        channelList.innerHTML = '';
        channels.forEach(channel => {
            const li = document.createElement('li');
            li.textContent = `${channel.name} (${channel.unread_count} unread)`;
            li.dataset.roomId = channel.id;
            li.addEventListener('click', () => navigateToChannel(channel.id,channel.name));
            channelList.appendChild(li);
        });
        highlightCurrentRoom(CURRENT_ROOM);
        
    });
};


const startUnreadUpdateInterval = () => {
  if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/profile")) {
      getChannels();
  }
};
// unread update for channels
setInterval(startUnreadUpdateInterval, 1000)


// Function to navigate to a channel
const navigateToChannel = (channelId,channelName) => {
    history.pushState(null, null, `/channel/${channelId}`);
    showOnly(MAIN_APP);
    removeHide(mainContent);
    addHide(replyThreads);
    CURRENT_ROOM = channelId;
    CURRENT_ROOM_NAME = channelName;
    highlightCurrentRoom(channelId);
    updateRoomNameDisplay(channelId);
    document.getElementById('message-list').innerHTML = '';
    lastMessageId = null;
    getMessages(channelId);
    startMessagePolling(channelId);
    if (window.innerWidth <= 767) {
      document.getElementById('sidebar').style.display = 'None';
      document.getElementById('channel-messages').style.display = 'Block';
      document.getElementById('mobile-channels-back').style.display = 'Block';
  }
};



let CURRENT_THREAD_REPLIES = [];

let lastMessageId = null;
// message fetching inside a channel
const MESSAGE_FETCH_INTERVAL = 500; 

// regex to handle images
const URL_REGEX = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|bmp|webp)/gi;

const createMessageElement = (message) => {
    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.messageId = message.id;
    
    // Message content
    const content = document.createElement('div');
    content.textContent = `${message.author}: ${message.body}`;
    div.appendChild(content);
    
    // Parse and display image URLs
    const imageUrls = message.body.match(URL_REGEX);
    if (imageUrls) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        
        imageUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Shared image';
            img.className = 'message-image';
            
            img.onerror = () => {
                img.style.display = 'none';
            };
            
            imageContainer.appendChild(img);
        });
        
        div.appendChild(imageContainer);
    }
    
    // Rest of the existing code for reply section, etc.
    const replySection = document.createElement('div');
    replySection.className = 'message-actions';
    
    const replyCount = document.createElement('span');
    replyCount.className = 'reply-count';
    replyCount.textContent = `${message.replies || 0} replies`;
    
    const replyButton = document.createElement('button');
    replyButton.className = 'thread-button';
    replyButton.textContent = 'Reply in Thread';
    replyButton.onclick = () => openThread(message.id, message.body, message.author);
    
    // Reactions container
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'reactions-container';
    
    // Add reaction button
    const addReactionBtn = document.createElement('button');
    addReactionBtn.className = 'add-reaction-btn';
    addReactionBtn.innerHTML = '+';
    addReactionBtn.onclick = (e) => {
        e.stopPropagation();
        toggleEmojiPicker(message.id);
    };
    
    reactionsContainer.appendChild(addReactionBtn);
    replySection.appendChild(reactionsContainer);
    replySection.appendChild(replyCount);
    replySection.appendChild(replyButton);
    
    div.appendChild(replySection);
    
    return div;
};

const getMessages = (channelId) => {
    const url = lastMessageId 
        ? `/api/messages/room/${channelId}?after=${lastMessageId}` 
        : `/api/messages/room/${channelId}`;

    fetch(url, {
        headers: { "Authorization": getSessionCookie() }
    })
    .then(response => response.json())
    .then(messages => {
        const messageList = document.getElementById('message-list');
        
        if (messages.length > 0) {
            // Update last message ID
            lastMessageId = messages[messages.length - 1].id;

            // Append new messages instead of clearing
            messages.forEach(message => {
                // Check if message already exists to prevent duplicates
                if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
                    const div = createMessageElement(message);
                    messageList.appendChild(div);
                    
                    // Immediately load reactions for new messages
                    loadReactions(message.id);
                }
            });

            messageList.scrollTop = messageList.scrollHeight;
        }
    })
    .catch(error => {
        console.error('Error fetching messages:', error);
    });
};

let messagePollingInterval;

const startMessagePolling = (channelId) => {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }

    // Start new interval
    messagePollingInterval = setInterval(() => {
        if (CURRENT_ROOM !== 0) {
            getMessages(CURRENT_ROOM);
        }
    }, MESSAGE_FETCH_INTERVAL);
};

const stopMessagePolling = () => {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    lastMessageId = null;
};

//  toggleEmojiPicker
const toggleEmojiPicker = (messageId) => {
  const existingPicker = document.querySelector('.emoji-picker');
  if (existingPicker) {
      existingPicker.remove();
      return;
  }

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  
  SUPPORTED_EMOJIS.forEach(emoji => {
      const emojiBtn = document.createElement('button');
      emojiBtn.className = 'emoji-option';
      emojiBtn.textContent = emoji;
      emojiBtn.onclick = () => {
          toggleReaction(messageId, emoji);
          picker.remove(); // Remove picker after selection
      };
      picker.appendChild(emojiBtn);
  });

  const message = document.querySelector(`[data-message-id="${messageId}"]`);
  message.appendChild(picker);

  // Close picker when clicking outside
  document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && !e.target.classList.contains('add-reaction-btn')) {
          picker.remove();
      }
  }, { once: true });
};


const toggleReaction = (messageId, emoji) => {
  fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': getSessionCookie()
      },
      body: JSON.stringify({'reaction': emoji })
  })
  .then(() => {
      // Refresh reactions for this message
      loadReactions(messageId);
  });
};

const loadReactions = (messageId) => {
  fetch(`/api/messages/${messageId}/reactions`, {
      headers: { 'Authorization': getSessionCookie() }
  })
  .then(response => response.json())
  .then(reactions => {
      const messageBox = document.querySelector(`[data-message-id="${messageId}"]`);
      
      // Ensure a reaction container exists
      let reactionDisplay = messageBox.querySelector('.reaction-container');
      if (!reactionDisplay) {
          reactionDisplay = document.createElement('div');
          reactionDisplay.className = 'reaction-container';
          messageBox.appendChild(reactionDisplay);
      }

      // Clear previous reactions
      reactionDisplay.innerHTML = '';
      
      Object.entries(reactions).forEach(([emoji, users]) => {
          const reactionBtn = document.createElement('button');
          reactionBtn.className = 'reaction';
          reactionBtn.dataset.emoji = emoji;
          reactionBtn.innerHTML = `${emoji} <span class="count">${users.length}</span>`;
          reactionBtn.title = users.join(', ');
          reactionBtn.onclick = () => toggleReaction(messageId, emoji);
          reactionDisplay.appendChild(reactionBtn);
      });
  });
};


const openThread = (messageId, messageBody = null, author = null) => {
  CURRENT_MESSAGE = messageId;

  if (!messageBody || !author) {
    // Fetch message details if not provided
    fetch(`/api/messages/${messageId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': getSessionCookie()
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }

        messageBody = data.message_body;
        author = data.author;

        // Proceed with rendering the thread
        renderThread(messageId, messageBody, author);
    })
    .catch(error => console.error('Error fetching message details:', error));
  } else {
    // Proceed with rendering the thread
    renderThread(messageId, messageBody, author);
  }
};

const renderThread = (messageId, messageBody, author) => {
  const newUrl = `/replies?channelid=${encodeURIComponent(CURRENT_ROOM)}&currentmessage=${encodeURIComponent(messageId)}`;
  window.history.pushState({}, '', newUrl);
  document.getElementById('parent-message').innerText = `${author}: ${messageBody}`;
  document.getElementById('thread-replies').classList.remove('hide');

  // Fetch replies for the thread
  fetch(`/api/messages/${messageId}/replies`, {
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': getSessionCookie()
      }
  })
  .then(response => response.json())
  .then(replies => {
      const replyList = document.getElementById('reply-list');
      replyList.innerHTML = '';

      replies.forEach(reply => {
          const replyDiv = document.createElement('div');
          replyDiv.className = 'reply';
          replyDiv.innerHTML = `
              <div>
                  <strong>${reply.author}</strong> 
                  <span class="reply-timestamp">(${new Date(reply.reply_date).toLocaleString()})</span>
              </div>
              <div>${reply.reply_content}</div>
          `;
          replyList.appendChild(replyDiv);
      });
  })
  .catch(error => console.error('Error fetching replies:', error));
  if (window.innerWidth <= 767) {
    document.getElementById('channel-messages').style.display = 'none';
    document.getElementById('thread-replies').classList.add('show');
    document.getElementById('mobile-channels-back').style.display = 'None';
    document.getElementById('mobile-thread-back').style.display = 'block';
}
};


document.getElementById('send-reply').addEventListener('click', () => {
  const messageId = CURRENT_MESSAGE;
  postReply(messageId);
});

const postReply = (parentId) => {
  const replyContent = document.getElementById('new-reply').value;

  // Validate reply content before making the request
  if (!replyContent.trim()) {
      alert("Reply content cannot be empty.");
      return;
  }

  fetch(`/api/messages/${parentId}/replies`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': getSessionCookie(),
      },
      body: JSON.stringify({ content: replyContent }),
  })
  .then(response => {
      if (!response.ok) {
          throw new Error("Failed to post reply.");
      }
      return response.json();
  })
  .then(data => {
      const { original_message, reply_id } = data;
      const { author, content } = original_message;

      // Call openThread with updated parent message details
      openThread(parentId, content, author);

      // Clear the reply input field
      document.getElementById('new-reply').value = '';
  })
  .catch(error => {
      console.error("Error posting reply:", error);
      alert("There was an error posting your reply. Please try again.");
  });
};
// posting a message in a channel
const postMessage = (roomId, messageBody) => {
  const sessionCookie = getSessionCookie(); 
  fetch('/api/room/messages/post', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionCookie 
      },
      body: JSON.stringify({
          room_id: roomId,
          message_body: messageBody,
      }),
  })
  .then(response => response.json())
  .then(data => {
      if (data.message === "success") {
          getMessages(roomId); 
          document.getElementById('new-message').value = '';
      } else {
          console.error('Error posting message:', data.error);
      }
  })
  .catch(error => {
      console.error('Error:', error);
  });
};

document.getElementById('send-message').addEventListener('click', () => {
  const messageBody = document.getElementById('new-message').value;
  const roomId = CURRENT_ROOM;

  if (messageBody.trim() !== '') {
      postMessage(roomId, messageBody); 
  } else {
      alert("Message body cannot be empty");
  }
});


// Event listeners to handle login and signup
document.getElementById('login-button').addEventListener('click', handleLogin);
document.getElementById('signup-button').addEventListener('click', handleSignup);
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Creating new channel
document.getElementById('create-channel-button').addEventListener('click', () => {
    const channelName = prompt("Enter channel name:");
    if (channelName) {
        fetch("/api/channels", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": getSessionCookie()
            },
            body: JSON.stringify({ name: channelName })
        })
        .then(() => getChannels());
    }
});

// Navigating to profile
document.getElementById('profile-section').addEventListener('click', () => {
  history.pushState(null, null, '/profile');
  router();
});

// Updating roomname
const updateRoomNameDisplay = async (roomId) => {
  try {
    const response = await fetch(`/api/channel/name/${roomId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": getSessionCookie()
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chanel name: ${response.statusText}`);
    }

    const data = await response.json();
    const roomName = data.channel_name;

    // Update room name display
    const roomNameDisplay = document.getElementById("roomNameDisplay");
    roomNameDisplay.textContent = roomName || `Channel ${roomId}`;

    // Update the room invite link
    const roomInvite = document.getElementById("roomInvite");
    roomInvite.href = `/channel/${roomId}`;
    roomInvite.textContent = `Invite users to this chat at: /channel/${roomId}`;

    roomNameDisplayer();
  } catch (error) {
    console.error("Error updating room name display:", error);
  }
};


document.getElementById('editButton').addEventListener('click', () => {


  displayRoomName.style.display = 'none';
  editRoomName.style.display = 'block';
  
  const roomNameInput = document.getElementById('roomNameInput');
  roomNameInput.value = CURRENT_ROOM_NAME;
});


document.getElementById('updateRoomNameButton').addEventListener('click', () => {
  const newRoomName = document.getElementById('roomNameInput').value.trim();
  
  if (newRoomName) {
      
      fetch(`/api/channels/name`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': getSessionCookie()
          },
          body: JSON.stringify({ room_id: CURRENT_ROOM, new_name: newRoomName })
      })
      .then(response => {
          if (!response.ok) throw new Error('Failed to update room name');
          return response.json();
      })
      .then(data => {
          // Update display
          CURRENT_ROOM_NAME = newRoomName;
          updateRoomNameDisplay(CURRENT_ROOM);
          
          // Switch back to display mode
          const displayRoomName = document.querySelector('.displayRoomName');
          const editRoomName = document.querySelector('.editRoomName');
          
          displayRoomName.style.display = 'block';
          editRoomName.style.display = 'none';
          
          // Refresh channels list to reflect name change
          getChannels();
      })
      .catch(error => {
          console.error('Error updating room name:', error);
          alert('Failed to update room name');
      });
  }
});

document.getElementById("update-username-button").addEventListener("click", async () => {
  const newUsername = document.querySelector("#update-username").value;
  
  try {
    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': getSessionCookie()
      },
      body: JSON.stringify({ new_username: newUsername })
    });
    
    if (res.ok) {
      const { username } = await res.json();
      alert("username updated")
      setUsername(username); 
      updateUsernameDisplay(); 
    }
  } catch (err) {
    console.error("Username update failed:", err);
  }
});

document.getElementById("update-password-button").addEventListener("click", async () => {
  const newPassword = document.querySelector("#update-password").value;
  
  try {
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': getSessionCookie()
      },
      body: JSON.stringify({ new_password: newPassword })
    });
    
    if (res.ok) {
      alert("password updated")
    }
  } catch (err) {
    console.error("password update failed:", err);
  }
});

// used for mobile screens
document.getElementById('mobile-channels-back').addEventListener('click', () => {
  document.getElementById('sidebar').style.display = 'block';
  document.getElementById('mobile-channels-back').style.display = 'None';
  document.getElementById('channel-messages').style.display = 'none';
});

document.getElementById('mobile-thread-back').addEventListener('click', () => {
  addHide(replyThreads);
  document.getElementById('mobile-channels-back').style.display = 'Block';
  document.getElementById('channel-messages').style.display = 'Block';
});   

replyClose.addEventListener("click",()=>{
  addHide(replyThreads);
  window.history.pushState({}, '', '/channel/'+CURRENT_ROOM);
})

// initialize
window.addEventListener("load", router);
window.addEventListener("popstate", router);