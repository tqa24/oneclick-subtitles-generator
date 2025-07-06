# Playwright Testing Guide

This guide documents how to test the One-Click Subtitles Generator application using Playwright browser automation.

## Prerequisites

- Application running locally (via `npm start`)
- Playwright tools available in the development environment

## Starting the Application

1. **Launch the development server:**
   ```bash
   npm start
   ```

2. **Handle port conflicts:**
   - If port 3008 is occupied, choose 'Y' to use an alternative port
   - Note the actual port from terminal output (usually 3009, 3010, 3011, etc.)

3. **Identify the correct URL:**
   - Try common ports: `http://localhost:3009`, `http://localhost:3010`, `http://localhost:3011`
   - Look for the page title "Subtitles Generator" to confirm correct port

## Basic Playwright Commands

### Navigation
```javascript
// Navigate to the application
await page.goto('http://localhost:3011');
```

### Taking Snapshots
```javascript
// Get page structure and interactive elements
await page.snapshot();
```

### Clicking Elements
```javascript
// Click using element reference from snapshot
await page.click('button[ref="e104"]');

// Click using role and name
await page.getByRole('button', { name: 'Open Settings' }).click();
```

### Handling Common UI Patterns

#### Dismissing Onboarding Overlays
```javascript
// Press Escape to dismiss overlays
await page.keyboard.press('Escape');
```

#### Interacting with Dropdowns/Selectors
```javascript
// Click to open dropdown
await page.getByRole('button', { name: 'Select Language' }).click();

// Select option from menu
await page.getByRole('menuitem', { name: '🇺🇸 English' }).click();
```

## Testing the Language Selector Dropup

### Step-by-Step Process

1. **Open Settings Modal:**
   ```javascript
   await page.getByRole('button', { name: 'Open Settings' }).click();
   ```

2. **Test Dropup Functionality:**
   ```javascript
   // Click language selector (should show dropup menu)
   await page.getByRole('button', { name: 'Select Language' }).click();
   
   // Verify menu is visible and positioned correctly
   const menu = await page.getByRole('menu');
   expect(menu).toBeVisible();
   ```

3. **Test Language Switching:**
   ```javascript
   // Select different language
   await page.getByRole('menuitem', { name: '🇺🇸 English' }).click();
   
   // Verify language change took effect
   await page.getByText('One-click Subtitles Generator').waitFor();
   ```

## Common Issues and Solutions

### Port Detection
- **Issue:** Application not loading on expected port
- **Solution:** Check terminal output for actual port, try sequential ports (3009, 3010, 3011)

### Element Interaction Blocked
- **Issue:** `TimeoutError` due to overlays blocking clicks
- **Solution:** Dismiss onboarding banners with `Escape` key first

### Timing Issues
- **Issue:** Elements not ready for interaction
- **Solution:** Use `waitFor()` methods or `act()` for state changes

### Language-Specific Testing
- **Issue:** Interface text changes based on current language
- **Solution:** Use element references or aria-labels instead of text content

## Best Practices

1. **Always dismiss onboarding overlays first:**
   ```javascript
   await page.keyboard.press('Escape');
   ```

2. **Use role-based selectors when possible:**
   ```javascript
   // Preferred
   await page.getByRole('button', { name: 'Settings' }).click();
   
   // Avoid
   await page.click('.settings-button');
   ```

3. **Wait for dynamic content:**
   ```javascript
   await page.waitFor(() => {
     return page.getByRole('menu').isVisible();
   });
   ```

4. **Take snapshots for debugging:**
   ```javascript
   // Useful for understanding current page state
   await page.snapshot();
   ```

## Example Test Scenarios

### Testing Dropup Positioning
```javascript
// Open settings and language selector
await page.getByRole('button', { name: 'Open Settings' }).click();
await page.getByRole('button', { name: 'Select Language' }).click();

// Verify dropup appears above button (in settings footer)
const menu = await page.getByRole('menu');
const button = await page.getByRole('button', { name: 'Select Language' });

// Menu should be positioned above button for dropup
const menuBox = await menu.boundingBox();
const buttonBox = await button.boundingBox();
expect(menuBox.y).toBeLessThan(buttonBox.y);
```

### Testing Language Persistence
```javascript
// Change language
await page.getByRole('menuitem', { name: '🇰🇷 한국어' }).click();

// Refresh page
await page.reload();

// Verify language persisted
await page.getByText('원클릭 자막 생성기').waitFor();
```

## Cleanup

Always stop the development server after testing:
```bash
# Kill the npm start process
Ctrl+C (or kill the terminal process)
```

## Notes

- The application uses React with i18n for internationalization
- Language selector uses `createPortal` for dropdown positioning
- Settings modal is positioned at the bottom of the viewport
- Dropup functionality is specifically used in the settings modal footer
