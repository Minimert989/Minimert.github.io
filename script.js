document.addEventListener('DOMContentLoaded', function() {
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // Function to create a new message element
    function createMessageElement(text, isUserMessage) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (isUserMessage) {
            messageElement.classList.add('user');
        } else {
            messageElement.classList.add('other');
        }
        messageElement.innerHTML = `<div class="text">${text}</div>`;
        return messageElement;
    }

    // Function to handle sending a message
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText) {
            // Create and add the user message
            const userMessage = createMessageElement(messageText, true);
            messagesContainer.appendChild(userMessage);

            // Clear the input field
            messageInput.value = '';

            // Simulate receiving a response (for demonstration purposes)
            setTimeout(() => {
                const responseMessage = createMessageElement('Received: ' + messageText, false);
                messagesContainer.appendChild(responseMessage);

                // Scroll to the bottom of the messages container
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 1000);
        }
    }

    // Add event listener to the send button
    sendButton.addEventListener('click', sendMessage);

    // Allow pressing Enter to send the message
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
});
