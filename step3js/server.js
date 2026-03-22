const express = require('express');
const path = require('path');
const app = express();
const port = 4101;

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Serve static files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
// Fallback for prefixed static files if Nginx doesn't strip the path
app.use('/step3js', express.static(publicPath));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// API endpoints
const apiRouter = express.Router();
apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '3D Viewer API is running' });
});

apiRouter.post('/analytics', express.json(), (req, res) => {
    console.log('Received analytics data:', req.body);
    res.json({ status: 'success' });
});

app.use('/api', apiRouter);
app.use('/step3js/api', apiRouter);

// Single Page App routing
const sendIndex = (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
};

app.get('/', sendIndex);
app.get('/step3js', sendIndex);
app.get(/^\/step3js\/.*/, sendIndex);
app.get(/.*/, sendIndex);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Accessible at https://ai-tworld.com/step3js`);
});
