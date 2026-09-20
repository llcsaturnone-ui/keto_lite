// Shared vendor entry lets the hosted app cache React separately from app code.
// The build only publishes the shared chunk, not this unused entry point.
export * from 'react';
export * from 'react-dom/client';
