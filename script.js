document.addEventListener('DOMContentLoaded', function() {
    const lights = Array.from(document.querySelectorAll('.light'));
    const button = document.getElementById('steeringWheel');
    const message = document.getElementById('message');

    let lightsOffTime;
    let gameStarted = false;

    function randomTime(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function turnOffLights() {
        const delay = randomTime(1000, 5000);
        lightsOffTime = Date.now() + delay;
        gameStarted = true;
        lights.forEach((light, index) => {
            setTimeout(() => {
                light.style.backgroundColor = '#000'; // Light goes off
            }, randomTime(0, delay));
        });
    }

    button.addEventListener('click', function() {
        if (!gameStarted) {
            message.textContent = 'Please wait for the lights to turn off!';
            return;
        }

        const currentTime = Date.now();
        if (currentTime < lightsOffTime) {
            message.textContent = 'Disqualified!';
        } else {
            const timeTaken = ((currentTime - lightsOffTime) / 1000).toFixed(2);
            message.textContent = `You took ${timeTaken} seconds to press the button!`;
        }
        gameStarted = false;
    });

    // Start the game when the page loads
    turnOffLights();
});
