// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references
const db = firebase.firestore();
const storage = firebase.storage();
const messagesRef = db.collection('messages');

// DOM elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const fileInput = document.getElementById('fileInput');
const sendButton = document.getElementById('sendButton');

// Display messages
function displayMessages() {
    messagesRef.orderBy('timestamp').onSnapshot(snapshot => {
        messagesContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            if (data.user) {
                messageElement.classList.add('user');
            } else {
                messageElement.classList.add('other');
            }
            if (data.text) {
                messageElement.innerHTML = `<div class="text">${data.text}</div>`;
            } else if (data.imageURL) {
                messageElement.innerHTML = `<img src="${data.imageURL}" alt="Image">`;
            }
            messagesContainer.appendChild(messageElement);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Send message
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText || fileInput.files.length > 0) {
        const messageData = {
            user: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (messageText) {
            messageData.text = messageText;
        }

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileRef = storage.ref().child('images/' + file.name);
            fileRef.put(file).then(snapshot => {
                return fileRef.getDownloadURL();
            }).then(url => {
                messageData.imageURL = url;
                return messagesRef.add(messageData);
            }).catch(error => {
                console.error('File upload error:', error);
            });
        } else {
            messagesRef.add(messageData).catch(error => {
                console.error('Message add error:', error);
            });
        }

        messageInput.value = '';
        fileInput.value = '';
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Initial display
displayMessages();
