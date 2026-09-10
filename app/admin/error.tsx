'use client';
export default function ErrorView({reset}:{reset:()=>void}){return <section className="empty-state"><h2>This view could not be loaded</h2><p>Your saved records are unaffected. Try loading the view again.</p><button onClick={reset}>Try again</button></section>;}
