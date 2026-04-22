import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Flows from './pages/Flows';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { Keywords, StoryReplies, CommentDMs } from './pages/Other';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/keywords" element={<Keywords />} />
            <Route path="/story-replies" element={<StoryReplies />} />
            <Route path="/comment-dms" element={<CommentDMs />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
