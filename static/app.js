// Constants for page elements
let CURRENT_ROOM = 0
let CURRENT_ROOM_NAME = "room_name_placeholder"
const AUTH_SECTION = document.getElementById('auth-section');
const MAIN_APP = document.getElementById('main-app');
const USER_PROFILE = document.getElementById('user-profile');
const mainContent = document.getElementById('main-content');
const parser = document.getElementById('ai-parser');
const channelList = document.getElementById('sidebar');
const displayRoomName = document.querySelector('.displayRoomName');
const editRoomName = document.querySelector('.editRoomName');
const parserClose = document.getElementById('parser-close');
const currentUsername = document.getElementById('current-username');
const jobsTable = document.getElementById('jobs-table');
const submitBtn = document.getElementById('parse-job');
const jobLinkInput = document.getElementById('jobLinkInput');
const parsingStatus = document.getElementById('parsingStatus');
const netWork = document.getElementById('network-page');


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


// Routing logic
const router = () => {
    let path = window.location.pathname;
    if (path === "/") {
        if (hasValidCredentials()) {
            showOnly(MAIN_APP);
            removeHide(mainContent);
            removeHide(jobsTable);
            addHide(netWork);
            addHide(parser);
            document.getElementById('jobsTableBody').innerHTML = '';
            loadJobs();
        } else {
            handleRedirectToLogin(path);
        }
    } else if (path === "/profile") {
        hasValidCredentials() ? showOnly(USER_PROFILE) : handleRedirectToLogin(path);
    } else if (path === "/login") {
        if (hasValidCredentials()) {
            showOnly(MAIN_APP);
            window.history.pushState({}, '', '/');
            removeHide(mainContent);
            removeHide(jobsTable);
            addHide(netWork);
            addHide(parser);
            document.getElementById('jobsTableBody').innerHTML = '';
            loadJobs();
        } else {
            showOnly(AUTH_SECTION);
        }
    } else {
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
    loadJobs();
};

// Update popup when value changes (through input or programmatically)
const updatePopup = (popup, value) => {
    popup.textContent = value;
};

async function addRow() {
    try {
        const response = await fetch('/api/create_job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getSessionCookie()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to create new job');
        }

        const { job_id } = await response.json();

        const tbody = document.getElementById('jobsTableBody');
        const row = tbody.insertRow();
        row.setAttribute('data-job-id', job_id);

        // Create cells for each column
        const columns = ['company', 'position', 'location', 'salary', 'description'];
        columns.forEach(column => {
            const cell = row.insertCell();

            // Create wrapper for hover functionality
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-wrapper';

            // Create input container
            const container = document.createElement('div');
            container.className = 'cell-content';

            const input = document.createElement('input');
            input.type = 'text';
            input.name = column;
            input.setAttribute('data-job-id', job_id);

            // Create popup for hover
            const popup = document.createElement('div');
            popup.className = 'cell-popup';

            // Bind popup to input events
            input.addEventListener('input', (event) => updatePopup(popup, event.target.value));
            input.addEventListener('change', (event) => updatePopup(popup, event.target.value));

            container.appendChild(input);
            wrapper.appendChild(container);
            wrapper.appendChild(popup);
            cell.appendChild(wrapper);
        });

        // Add action buttons cell
        const actionCell = row.insertCell();
        const actionButtons = createActionButtons(job_id);
        actionCell.appendChild(actionButtons);

    } catch (error) {
        console.error('Error adding new row:', error);
        alert('Failed to create new job. Please try again.');
    }
}


function createSaveButton(job_id) {
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾'; // Save icon
    saveButton.className = 'save-job-btn';
    saveButton.setAttribute('data-job-id', job_id);
    saveButton.addEventListener('click', () => saveJob(job_id));
    return saveButton;
}

async function saveJob(job_id) {
    const row = document.querySelector(`tr[data-job-id="${job_id}"]`);
    const saveButton = row.querySelector('.save-job-btn');
    const inputs = row.querySelectorAll('input');
    
    const jobData = {
        job_id: job_id,
        company: inputs[0].value,
        position: inputs[1].value,
        location: inputs[2].value,
        salary: inputs[3].value,
        description: inputs[4].value,
        job_link: inputs[5].value
    };

    try {
        saveButton.innerHTML = '⏳';
        saveButton.disabled = true;

        const response = await fetch('/api/save_job', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getSessionCookie()
            },
            body: JSON.stringify(jobData),
        });

        if (!response.ok) {
            throw new Error('Failed to save job');
        }

        saveButton.innerHTML = '✅';
        setTimeout(() => {
            saveButton.innerHTML = '💾';
            saveButton.disabled = false;
        }, 1000);

    } catch (error) {
        console.error('Error saving job:', error);
        saveButton.innerHTML = '❌';
        setTimeout(() => {
            saveButton.innerHTML = '💾';
            saveButton.disabled = false;
        }, 1000);
        alert('Failed to save job. Please try again.');
    }
}

function parseJobLink() {
    const jobLink = document.getElementById('jobLink').value;

    fetch('/parse_job_link', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobLink }),
    })
    .then(response => response.json())
    .then(data => {
        addRow(); // Add a new row dynamically
        const inputs = document.querySelectorAll('#jobsTableBody tr:last-child input');
        const popups = document.querySelectorAll('#jobsTableBody tr:last-child .cell-popup');

        // Populate input fields with parsed data and update popups
        const columns = ['company', 'position', 'location', 'salary', 'description'];
        columns.forEach((column, index) => {
            const input = inputs[index];
            const popup = popups[index];

            // Set initial values
            input.value = data[column] || '';
            popup.textContent = data[column] || '';

            // Attach listeners to update the popup dynamically
            input.addEventListener('input', (event) => {
                popup.textContent = event.target.value;
            });
            input.addEventListener('change', (event) => {
                popup.textContent = event.target.value;
            });
        });
    })
    .catch(error => console.error('Error parsing job link:', error));
}




const highlightCurrentMenu = (menuPage) => {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    
    // Remove any existing highlight
    menuItems.forEach(item => {
        item.classList.remove('current-item');
    });

    // Highlight the selected menuPage
    if (menuPage) {
        menuPage.classList.add('current-item');
    }
};

// Function to navigate to a channel
const showMain = (menuPage) => {
    // Highlight the selected menu item
    highlightCurrentMenu(menuPage);

    // Get the `data-page` value to determine the action
    const page = menuPage.dataset.page;

    // Perform actions based on the page keyword
    switch (page) {
        case 'network':
            // Code for showing the Network page
            showOnly(MAIN_APP);
            removeHide(mainContent);
            addHide(jobsTable);
            addHide(parser);
            removeHide(netWork);
            break;

        case 'jobs':
            // Code for showing the Jobs page
            showOnly(MAIN_APP);
            removeHide(mainContent);
            removeHide(jobsTable);
            addHide(netWork);
            addHide(parser);
            document.getElementById('jobsTableBody').innerHTML = '';
            loadJobs();
            break;

        case 'applied':
            // Code for showing the Applied page
            showOnly(MAIN_APP);
            removeHide(mainContent);
            addHide(parser);
            loadAppliedContent();
            break;

        case 'materials':
            // Code for showing the Materials page
            showOnly(MAIN_APP);
            removeHide(mainContent);
            addHide(parser);
            loadMaterialsContent();
            break;

        default:
            console.error('Unknown page:', page);
            break;
    }
};





// Event listeners to handle login and signup
document.getElementById('login-button').addEventListener('click', handleLogin);
document.getElementById('signup-button').addEventListener('click', handleSignup);
document.getElementById('logout-button').addEventListener('click', handleLogout);



// Navigating to profile
document.getElementById('profile-section').addEventListener('click', () => {
  history.pushState(null, null, '/profile');
  router();
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


let jobs = [];
const jobsTableBody = document.getElementById('jobsTableBody');

async function loadJobs() {
    try {
        const response = await fetch('/api/jobs', {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": getSessionCookie()
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        renderJobs(data.jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
        // Optionally show error to user
        const tbody = document.getElementById('jobsTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500">Failed to load jobs. Please try again.</td></tr>';
    }
}

// Render jobs to table
function renderJobs(jobs) {
    const tbody = document.getElementById('jobsTableBody');
    tbody.innerHTML = '';

    jobs.forEach(job => {
        const row = document.createElement('tr');
        row.setAttribute('data-job-id', job.job_id);

        // Add job_link to columns array
        const columns = ['company', 'position', 'location', 'salary', 'description', 'job_link'];
        columns.forEach(column => {
            const cell = document.createElement('td');
            if (column === 'job_link') {
                cell.className = 'job-link-cell';
            }
            
            // Create wrapper for hover functionality
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-wrapper';

            // Create input container
            const container = document.createElement('div');
            container.className = 'cell-content';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = job[column] || '';
            input.name = column;
            input.setAttribute('data-job-id', job.job_id);

            // Create popup for hover
            const popup = document.createElement('div');
            popup.className = 'cell-popup';
            popup.textContent = job[column] || '';

            // For job_link, make it clickable if it exists
            if (column === 'job_link' && job[column]) {
                const link = document.createElement('a');
                link.href = job[column];
                link.target = '_blank';
                link.textContent = '🔗';
                link.title = job[column];  // Show full URL on hover
                container.appendChild(link);
            }

            container.appendChild(input);
            wrapper.appendChild(container);
            wrapper.appendChild(popup);
            cell.appendChild(wrapper);

            row.appendChild(cell);
        });

        // Add action buttons cell
        const actionCell = document.createElement('td');
        const actionButtons = createActionButtons(job.job_id);
        actionCell.appendChild(actionButtons);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}



function createActionButtons(job_id) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'action-buttons';
    
    // Save Button
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾';
    saveButton.className = 'save-job-btn';
    saveButton.setAttribute('data-job-id', job_id);
    saveButton.addEventListener('click', () => saveJob(job_id));
    
    // Delete Button
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '🗑️';
    deleteButton.className = 'delete-job-btn';
    deleteButton.setAttribute('data-job-id', job_id);
    deleteButton.addEventListener('click', () => deleteJob(job_id));
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(deleteButton);
    return buttonContainer;
}

async function deleteJob(job_id) {
    if (!confirm('Are you sure you want to delete this job?')) {
        return;
    }

    const row = document.querySelector(`tr[data-job-id="${job_id}"]`);
    const deleteButton = row.querySelector('.delete-job-btn');

    try {
        deleteButton.innerHTML = '⏳'; // Loading state
        deleteButton.disabled = true;

        const response = await fetch(`/api/delete_job/${job_id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getSessionCookie()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete job');
        }

        // Animate row removal
        row.style.animation = 'fadeOut 0.5s';
        setTimeout(() => {
            row.remove();
        }, 500);

    } catch (error) {
        console.error('Error deleting job:', error);
        deleteButton.innerHTML = '❌';
        setTimeout(() => {
            deleteButton.innerHTML = '🗑️';
            deleteButton.disabled = false;
        }, 1000);
        alert('Failed to delete job. Please try again.');
    }
}

submitBtn.onclick = async () => {
    const jobLink = jobLinkInput.value.trim();
    if (!jobLink) {
        parsingStatus.textContent = 'Please enter a valid job link';
        return;
    }

    try {
        submitBtn.disabled = true;
        parsingStatus.textContent = 'Parsing job details...';
        parsingStatus.className = 'parsing-status loading';

        const response = await fetch('/api/parse_job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getSessionCookie()
            },
            body: JSON.stringify({ job_link: jobLink })
        });

        if (!response.ok) {
            throw new Error('Failed to parse job details');
        }

        const { job_id, ...jobDetails } = await response.json();

        // Add new row with parsed details
        const tbody = document.getElementById('jobsTableBody');
        const row = document.createElement('tr');
        row.setAttribute('data-job-id', job_id);

        // Add cells for each field including job_link
        ['company', 'position', 'location', 'salary', 'description', 'job_link'].forEach(field => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = field === 'job_link' ? jobLink : (jobDetails[field] || '');
            input.name = field;
            input.setAttribute('data-job-id', job_id);
            cell.appendChild(input);
            row.appendChild(cell);
        });

        // Add action buttons
        const actionCell = document.createElement('td');
        const actionButtons = createActionButtons(job_id);
        actionCell.appendChild(actionButtons);
        row.appendChild(actionCell);

        // Insert the new row at the top
        tbody.insertBefore(row, tbody.firstChild);

        parsingStatus.className = 'parsing-status';
        jobLinkInput.value = ''; // Clear the input after successful parsing

    } catch (error) {
        console.error('Error parsing job:', error);
        parsingStatus.textContent = 'Failed to parse job details. Please try again.';
        parsingStatus.className = 'parsing-status error';
    } finally {
        submitBtn.disabled = false;
    }
};


const openAIparser = () => {
    removeHide(parser)
};

parserClose.addEventListener("click",()=>{
    addHide(parser);
  })



//   document.getElementById("add-contact-btn").addEventListener("click", () => {
//     document.getElementById("contact-form").style.display = "block";
//   });
  
//   document.getElementById("save-contact").addEventListener("click", () => {
//     const name = document.getElementById("name").value;
//     const position = document.getElementById("position").value;
//     const company = document.getElementById("company").value;
//     const email = document.getElementById("email").value;
//     const linkedin = document.getElementById("linkedin").value;
//     const notes = document.getElementById("notes").value;
  
//     const table = document.getElementById("contacts-table").querySelector("tbody");
//     const row = document.createElement("tr");
//     row.innerHTML = `
//       <td>${name}</td>
//       <td>${position}</td>
//       <td>${company}</td>
//       <td>${email}</td>
//       <td><a href="${linkedin}" target="_blank">LinkedIn</a></td>
//       <td contenteditable="true">${notes}</td>
//       <td><button class="delete-btn">Delete</button></td>
//     `;
//     table.appendChild(row);
  
//     // Clear the form and hide it
//     document.getElementById("contact-form").style.display = "none";
//     document.getElementById("name").value = "";
//     document.getElementById("position").value = "";
//     document.getElementById("company").value = "";
//     document.getElementById("email").value = "";
//     document.getElementById("linkedin").value = "";
//     document.getElementById("notes").value = "";
  
//     // Add delete functionality
//     row.querySelector(".delete-btn").addEventListener("click", () => {
//       row.remove();
//     });
//   });
  
//   document.getElementById("search-bar").addEventListener("input", (e) => {
//     const filter = e.target.value.toLowerCase();
//     const rows = document.querySelectorAll("#contacts-table tbody tr");
//     rows.forEach(row => {
//       const text = row.textContent.toLowerCase();
//       row.style.display = text.includes(filter) ? "" : "none";
//     });
//   });
  
// Event Listeners
document.getElementById('addRowBtn').addEventListener('click', openAIparser);

// Initial load
loadJobs();
// initialize
window.addEventListener("load", router);
window.addEventListener("popstate", router);


document.addEventListener("DOMContentLoaded", () => {
    // Fetch and display networks on page load
    fetch("/api/networks", { method: "GET", headers: { 'Authorization': getSessionCookie() } })
      .then(response => response.json())
      .then(data => {
        if (data.networks) {
          const table = document.getElementById("contacts-table").querySelector("tbody");
          data.networks.forEach(network => {
            const row = createNetworkRow(network);
            table.appendChild(row);
          });
        }
      })
      .catch(err => console.error("Error fetching networks:", err));
  
    // Add a new network
    document.getElementById("save-contact").addEventListener("click", () => {
      const name = document.getElementById("name").value.trim();
      const position = document.getElementById("position").value.trim();
      const company = document.getElementById("company").value.trim();
      const email = document.getElementById("email").value.trim();
      const linkedin = document.getElementById("linkedin").value.trim();
      const notes = document.getElementById("notes").value.trim();
  
      if (!name) {
        alert("Network name is required!");
        return;
      }
  
      fetch("/api/networks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': getSessionCookie()
        },
        body: JSON.stringify({ name, position, company, email, linkedin, notes })
      })
        .then(response => response.json())
        .then(data => {
          if (data.network_id) {
            const table = document.getElementById("contacts-table").querySelector("tbody");
            const row = createNetworkRow(data);
            table.appendChild(row);
  
            // Clear the form
            document.getElementById("contact-form").style.display = "none";
            clearForm();
          } else {
            alert("Error saving network: " + (data.error || "Unknown error"));
          }
        })
        .catch(err => console.error("Error saving network:", err));
    });
  
    // Search functionality
    document.getElementById("search-bar").addEventListener("input", (e) => {
      const filter = e.target.value.toLowerCase();
      const rows = document.querySelectorAll("#contacts-table tbody tr");
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? "" : "none";
      });
    });
  
    // Show the form to add a new network
    document.getElementById("add-contact-btn").addEventListener("click", () => {
      document.getElementById("contact-form").style.display = "block";
    });
  });
  
  function createNetworkRow(network) {
    const row = document.createElement("tr");
    row.dataset.networkId = network.network_id;
    row.innerHTML = `
      <td>${network.name}</td>
      <td>${network.position}</td>
      <td>${network.company}</td>
      <td>${network.email}</td>
      <td><a href="${network.linkedin}" target="_blank">LinkedIn</a></td>
      <td contenteditable="true">${network.notes}</td>
      <td><button class="delete-btn">Delete</button></td>
    `;
  
    // Add delete functionality
    row.querySelector(".delete-btn").addEventListener("click", () => {
      deleteNetwork(network.network_id, row);
    });
  
    // Handle inline editing (update network)
    row.querySelector("td[contenteditable='true']").addEventListener("blur", () => {
      const updatedData = {
        name: row.cells[0].textContent.trim(),
        position: row.cells[1].textContent.trim(),
        company: row.cells[2].textContent.trim(),
        email: row.cells[3].textContent.trim(),
        linkedin: row.cells[4].querySelector("a").href,
        notes: row.cells[5].textContent.trim()
      };
      updateNetwork(network.network_id, updatedData);
    });
  
    return row;
  }
  
  function deleteNetwork(networkId, row) {
    fetch(`/api/networks/${networkId}`, {
      method: "DELETE",
      headers: { 'Authorization': getSessionCookie() }
    })
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          row.remove();
        } else {
          alert("Error deleting network: " + (data.error || "Unknown error"));
        }
      })
      .catch(err => console.error("Error deleting network:", err));
  }
  
  function updateNetwork(networkId, updatedData) {
    fetch(`/api/networks/${networkId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        'Authorization': getSessionCookie()
      },
      body: JSON.stringify(updatedData)
    })
      .then(response => response.json())
      .then(data => {
        if (!data.message) {
          alert("Error updating network: " + (data.error || "Unknown error"));
        }
      })
      .catch(err => console.error("Error updating network:", err));
  }
  
  function clearForm() {
    document.getElementById("name").value = "";
    document.getElementById("position").value = "";
    document.getElementById("company").value = "";
    document.getElementById("email").value = "";
    document.getElementById("linkedin").value = "";
    document.getElementById("notes").value = "";
  }
  
    document.getElementById("cancel-contact").addEventListener("click", () => {
    document.getElementById("contact-form").style.display = "none";
  });
  