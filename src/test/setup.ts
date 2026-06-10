import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// With `globals: false` Testing Library cannot register its own afterEach.
afterEach(cleanup);
