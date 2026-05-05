import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Toasts from './ui/Toasts';

export default function App() {
  return (
    <div className="min-h-full text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Lobby />} />
        <Route path="/play/:code" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </div>
  );
}
