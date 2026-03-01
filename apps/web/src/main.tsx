import React from 'react';
import { createRoot } from 'react-dom/client';
import { API_BASE_PATH, QUIZ_CATEGORIES } from '@ronaldo/shared';

export const App = () => {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem' }}>
      <h1>Quiz Monorepo Starter</h1>
      <p>
        Web app served with Vite, sharing typed contracts from <code>@ronaldo/shared</code>.
      </p>
      <p>
        API health endpoint: <code>{`${API_BASE_PATH}/health`}</code>
      </p>
      <h2>Supported Categories</h2>
      <ul>
        {QUIZ_CATEGORIES.map((category) => (
          <li key={category}>{category}</li>
        ))}
      </ul>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
