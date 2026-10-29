import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Screens are loaded lazily; with the whole suite running in parallel the default 1 s wait for one to appear is too tight.
configure({ asyncUtilTimeout: 8000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
