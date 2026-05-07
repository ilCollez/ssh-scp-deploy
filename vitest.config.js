import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/unit/**/*.test.js'],
        environment: 'node',
        globals: true,
        clearMocks: true,
        restoreMocks: true,
        pool: 'forks',
        coverage: {
            provider: 'v8',
            include: ['lib/**/*.js'],
            reporter: ['text', 'html', 'lcov'],
            thresholds: {
                lines: 90,
                functions: 95,
                branches: 80,
                statements: 90,
            },
        },
    },
});
