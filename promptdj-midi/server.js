import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3037;
const DIST_DIR = path.join(__dirname, 'dist');

// Check if build exists
if (!fs.existsSync(DIST_DIR)) {
    console.warn('⚠️  PromptDJ MIDI build directory not found (dist/).');
    console.warn('    Please run "npm run build" in the promptdj-midi workspace.');
}

// Serve static files from the React app build directory
app.use(express.static(DIST_DIR));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('PromptDJ MIDI Service: Application not built (index.html missing)');
    }
});

app.listen(PORT, () => {
    console.log(`PromptDJ MIDI Service running on port ${PORT}`);
});
