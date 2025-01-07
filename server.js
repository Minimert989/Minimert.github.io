const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

app.post('/log-ip', (req, res) => {
    const visitorIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const log = `IP: ${visitorIP} - Time: ${new Date().toISOString()}\n`;
    
    // Append the log to a file
    fs.appendFileSync('ips.txt', log);
    
    console.log(log); // Log in the console (optional)
    res.status(200).send('IP Logged');
});

app.listen(3000, () => console.log('Server is running on port 3000'));
