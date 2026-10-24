import { Link } from 'react-router-dom';

interface MdxModule {
  meta?: {
    title: string;
    date: string;
  };
}

// Hilfsfunktion: Wandelt das Datum zum Sortieren in eine Zahl um
function getSortValue(dateString: string): number {
  if (!dateString) return 0;

  const lower = dateString.toLowerCase();
  // "Active" oder "Current" Projekte werden als unendlich in der Zukunft gewertet -> immer ganz oben
  if (lower.includes('active') || lower.includes('current')) {
    return Infinity;
  }

  // Versucht, Strings wie "Oct 2026" in einen Zeitstempel zu parsen
  const parsed = Date.parse(dateString);
  return isNaN(parsed) ? 0 : parsed;
}

export default function Home() {
  const mdxFiles = import.meta.glob<MdxModule>('../content/*.mdx', { eager: true });

  const projects = Object.entries(mdxFiles)
    .map(([path, module]) => {
      const slug = path.replace('../content/', '').replace('.mdx', '');
      return {
        slug,
        title: module.meta?.title || slug,
        date: module.meta?.date || '',
      };
    })
    // Hier sortieren wir: b.date minus a.date (absteigend, neueste zuerst)
    .sort((a, b) => getSortValue(b.date) - getSortValue(a.date));

  return (
    <section>
      {/* Name & Short Bio */}
      <h1 className="mb-3 text-2xl font-bold">Florian Setzwein</h1>
      <p className="mb-6 leading-relaxed text-gray-600">
        Senior Software Engineer bridging scientific computing and industrial machine learning. I
        build performance-critical simulation tools (C/C++) and data-driven production systems
        (Python, React).
      </p>
      {/* Currently at BASF; previously researcher at DLR with a PhD in Aerospace
        Engineering. 
      */}

      {/* Minimalist Professional Links */}
      <div className="mb-12 flex gap-5 border-b border-gray-200 pb-6 font-mono text-sm">
        <a
          href="https://github.com/FloSewn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 transition-colors hover:text-blue-800"
        >
          GitHub
        </a>
        <a
          href="https://linkedin.com/in/floriansw"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 transition-colors hover:text-blue-800"
        >
          LinkedIn
        </a>
        <a
          href="https://orcid.org/0000-0002-5835-7788"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 transition-colors hover:text-blue-800"
        >
          ORCID
        </a>
      </div>

      {/* Projects & Articles List */}
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Projects & Articles</h2>
      <ul className="space-y-5">
        {projects.map((project) => (
          <li key={project.slug} className="group">
            <Link
              to={`/projects/${project.slug}`}
              className="mb-0.5 inline-block font-medium text-gray-900 transition-colors group-hover:text-blue-600"
            >
              {project.title}
            </Link>
            <span className="block font-mono text-sm tracking-tight text-gray-500">
              {project.date}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
