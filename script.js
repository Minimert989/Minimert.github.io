document.addEventListener('DOMContentLoaded', function() {
    const ipAddressElement = document.getElementById('ipAddress');

    // Function to fetch the IP address from an API
    function fetchIP() {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                ipAddressElement.textContent = data.ip;
            })
            .catch(error => {
                ipAddressElement.textContent = 'Unable to fetch IP address.';
                console.error('Error fetching IP address:', error);
            });
    }

    // Fetch the IP address when the page loads
    fetchIP();
});
