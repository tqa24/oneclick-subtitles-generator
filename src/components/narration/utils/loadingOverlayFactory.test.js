import { createSimpleLoadingOverlay } from './loadingOverlayFactory';

describe('createSimpleLoadingOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('mounts a DOM overlay showing the message and removes it on destroy', () => {
    const overlay = createSimpleLoadingOverlay('Preparing download');
    expect(document.body.contains(overlay.container)).toBe(true);
    expect(overlay.container.textContent).toContain('Preparing download');

    overlay.destroy();
    expect(document.body.contains(overlay.container)).toBe(false);
  });

  test('updateProgress changes the displayed message; destroy is idempotent', () => {
    const overlay = createSimpleLoadingOverlay('first');
    overlay.updateProgress({ message: 'second' });
    expect(overlay.container.textContent).toContain('second');

    overlay.destroy();
    expect(() => overlay.destroy()).not.toThrow();
    expect(document.body.contains(overlay.container)).toBe(false);
  });
});
