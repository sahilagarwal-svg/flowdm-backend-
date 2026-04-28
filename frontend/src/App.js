import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Flows from './pages/Flows';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { Keywords, StoryReplies, CommentDMs } from './pages/Other';

function ProtectedLayout() {
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/flows"        element={<Flows />} />
          <Route path="/keywords"     element={<Keywords />} />
          <Route path="/story-replies" element={<StoryReplies />} />
          <Route path="/comment-dms"  element={<CommentDMs />} />
          <Route path="/analytics"    element={<Analytics />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/instaauto">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*"     element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
