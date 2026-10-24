import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Project from './pages/Project';

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-gray-50 px-6 py-12 font-sans text-gray-900">
      <header className="mb-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight text-black no-underline">
          F.
        </Link>
        <nav>
          <Link to="/" className="text-sm text-gray-600 transition-colors hover:text-black">
            Overview
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects/:slug" element={<Project />} />
        </Routes>
      </main>
    </div>
  );
}
