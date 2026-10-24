import { Link } from 'react-router-dom';

// Typisierung für unsere exportierten Metadaten aus den MDX-Dateien
interface MdxModule {
  meta?: {
    title: string;
    date: string;
  };
}

export default function Home() {
  // Liest alle MDX-Dateien im content-Ordner aus
  const mdxFiles = import.meta.glob<MdxModule>('../content/*.mdx', { eager: true });

  // Verwandelt das Objekt in ein Array und extrahiert den "slug" aus dem Dateipfad
  const projects = Object.entries(mdxFiles).map(([path, module]) => {
    // Macht aus "../content/tqmesh.mdx" einfach "tqmesh"
    const slug = path.replace('../content/', '').replace('.mdx', '');

    return {
      slug,
      title: module.meta?.title || slug,
      date: module.meta?.date || '',
    };
  });

  // Optional: Du könntest das Array hier nach Datum sortieren,
  // aktuell belassen wir es bei der alphabetischen Reihenfolge der Dateinamen.

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Florian</h1>
      <p className="mb-8 text-gray-600">
        Software Developer. Fokus auf numerische Mathematik, C++ und Mesh Generation.
      </p>

      <h2 className="mb-4 border-b pb-2 text-lg font-semibold">Projekte & Artikel</h2>
      <ul className="space-y-4">
        {projects.map((project) => (
          <li key={project.slug}>
            <Link to={`/projects/${project.slug}`} className="text-blue-600 hover:underline">
              {project.title}
            </Link>
            <span className="block text-sm text-gray-500">{project.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
