/**
 * Controller for settings operations
 */
const fs = require('fs').promises;
const path = require('path');

/**
 * Update the prompts in the geminiImageController.js file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePrompts = async (req, res) => {
  try {
    const { promptOne, promptTwo } = req.body;

    if (!promptOne || !promptTwo) {
      return res.status(400).json({ error: 'Both prompts are required' });
    }

    // Check if promptTwo contains ${prompt}
    if (!promptTwo.includes('${prompt}')) {
      return res.status(400).json({ error: 'The second prompt must contain ${prompt}' });
    }

    // Read the geminiImageController.js file
    const filePath = path.join(process.cwd(), 'server', 'controllers', 'geminiImageController.js');
    let content = await fs.readFile(filePath, 'utf-8');

    // Replace the first prompt (lines 48-54)
    const promptOneRegex = /(const content = `[\s\S]*?`;)/;
    content = content.replace(promptOneRegex, `const content = \`${promptOne}\`;`);

    // Replace the second prompt (line 201)
    const promptTwoRegex = /(const finalPrompt = `[\s\S]*?`;)/;
    content = content.replace(promptTwoRegex, `const finalPrompt = \`${promptTwo}\`;`);

    // Write the updated content back to the file
    await fs.writeFile(filePath, content, 'utf-8');

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating prompts:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  updatePrompts
};
