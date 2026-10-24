import { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';

// Vite sucht beim Build-Prozess alle MDX-Dateien in diesem Ordner
const mdxModules = import.meta.glob('../content/*.mdx');

export default function Project() {
  const { slug } = useParams<{ slug: string }>();

  // Prüfe, ob es eine MDX-Datei für diesen Slug gibt
  const importMdx = mdxModules[`../content/${slug}.mdx`];

  if (!importMdx) {
    return <div className="mt-12 text-gray-500">Projekt "{slug}" nicht gefunden.</div>;
  }

  // Wandelt den Import in eine ladbare React-Komponente um
  const MdxContent = lazy(importMdx as any);

  return (
    // prose und prose-gray aktivieren das Tailwind Typography Plugin für perfektes Markdown-Styling
    <article className="prose prose-gray prose-p:leading-relaxed mt-8 max-w-none">
      <Suspense fallback={<p className="text-gray-500">Lade Artikel...</p>}>
        <MdxContent />
      </Suspense>
    </article>
  );
}
