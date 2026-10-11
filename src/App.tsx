import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Aperture, ArrowRight, Bookmark, Check, ChevronRight, Compass, Copy, Flag,
  Heart, Image, Menu, Search, Sparkles, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { categories, prompts, type Category, type PromptEntry } from '@/data/prompts';

const queryClient = new QueryClient();
const searchablePrompts = prompts.map((item) => ({
  item,
  searchText: [item.title, item.description, item.category, item.prompt, ...item.keywords]
    .join(' ')
    .toLocaleLowerCase('pt-BR'),
}));
const featuredPrompts = prompts.filter((prompt) => prompt.featured).slice(0, 6);
const navItems = [
  { label: 'Dashboard', path: '/', icon: Aperture },
  ...categories.map(({ name, route, icon }) => ({
    label: name, path: route,
    icon: icon === 'compass' ? Compass : icon === 'flag' ? Flag : icon === 'sparkles' ? Sparkles : Image,
  })),
  { label: 'Todos os prompts', path: '/prompts', icon: Image },
  { label: 'Favoritos', path: '/favoritos', icon: Heart },
];
const categoryCounts = prompts.reduce((acc, prompt) => {
  acc[prompt.category] = (acc[prompt.category] ?? 0) + 1;
  return acc;
}, {} as Record<Category, number>);

type ToastState = { message: string; error?: boolean } | null;

function LensMark() {
  return <svg className="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
    <circle cx="22" cy="22" r="18" stroke="#A78BFA" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="12.5" stroke="#6D55A1" strokeWidth="1"/>
    <circle cx="22" cy="22" r="7.2" fill="url(#lens-fill)" stroke="#C4B5FD" strokeWidth="1.2"/>
    <path d="M22 4v6M40 22h-6M22 40v-6M4 22h6" stroke="#A78BFA" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M13 13l3.1 3.1M31 31l-3.1-3.1M31 13l-3.1 3.1M13 31l3.1-3.1" stroke="#7258AA" strokeWidth="1"/>
    <circle cx="19.5" cy="19.5" r="2" fill="#F8F7FC" opacity=".8"/>
    <defs><radialGradient id="lens-fill"><stop stopColor="#C4B5FD"/><stop offset="1" stopColor="#6134B2"/></radialGradient></defs>
  </svg>;
}

function Sidebar({ path, favoritesCount, onNavigate }: { path: string; favoritesCount: number; onNavigate?: () => void }) {
  return <>
    <Link href="/" className="brand" aria-label="Pixora AI, início" onClick={onNavigate} data-testid="link-brand">
      <LensMark/><span className="brand-name">PIXORA<span className="brand-ai">AI</span></span>
    </Link>
    <div className="nav-caption">Biblioteca criativa</div>
    <nav className="nav-list" aria-label="Navegação principal">
      {navItems.map(({ label, path: itemPath, icon: Icon }) => {
        const selected = itemPath === '/' ? path === '/' : path === itemPath;
        const count = itemPath === '/favoritos' ? favoritesCount : categories.find((entry) => entry.route === itemPath) ? categoryCounts[label as Category] : undefined;
        return <Link key={itemPath} href={itemPath} className={`nav-link${selected ? ' active' : ''}`} aria-current={selected ? 'page' : undefined} onClick={onNavigate} data-testid={`link-nav-${itemPath.slice(1) || 'inicio'}`}>
          <Icon size={17} strokeWidth={1.8}/><span>{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}
        </Link>;
      })}
    </nav>
    <div className="side-note">
      <div className="side-note-label">Um bom ponto de partida</div>
      <p>Uma ideia merece um prompt à altura. Encontre o seu próximo.</p>
      <Link href="/prompts" className="side-note-link" onClick={onNavigate} data-testid="link-side-discover">Explorar biblioteca <ArrowRight size={13}/></Link>
    </div>
  </>;
}

function SearchBox({ value, onChange, onClear, compact = false }: { value: string; onChange: (value: string) => void; onClear: () => void; compact?: boolean }) {
  return <div className="search-wrap" role="search" aria-label="Buscar prompts">
    <Search size={18} aria-hidden="true"/>
    <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Pesquise por fotos, lugares, times ou estilos..." aria-label="Pesquise por fotos, lugares, times ou estilos..." data-testid={compact ? 'input-search-list' : 'input-search-home'}/>
    {value && <button type="button" className="clear-search" aria-label="Limpar busca" onClick={onClear} data-testid="button-clear-search"><X size={16}/></button>}
  </div>;
}

function CategoryCards({ onOpen }: { onOpen: () => void }) {
  return <div className="category-grid">
    {categories.map((category) => {
      const Icon = category.icon === 'compass' ? Compass : category.icon === 'flag' ? Flag : category.icon === 'sparkles' ? Sparkles : Aperture;
      return <Link href={category.route} key={category.name} className="category-card" onClick={onOpen} data-testid={'card-category-' + category.route.slice(1)}>
        <span className="category-icon"><Icon size={18}/></span>
        <span className="category-count">{categoryCounts[category.name]} prompts</span>
        <h3>{category.name}</h3><p>{category.description}</p>
      </Link>;
    })}
  </div>;
}

const PromptCard = memo(function PromptCard({ item, isFavorite, copied, onFavorite, onCopy, onView }: {
  item: PromptEntry; isFavorite: boolean; copied: boolean;
  onFavorite: (item: PromptEntry) => void; onCopy: (item: PromptEntry) => void; onView: (item: PromptEntry) => void;
}) {
  return <article className="prompt-card" data-testid={`card-prompt-${item.id}`}>
    <div className="card-meta">
      <span className="tag">{item.category}</span>
      {item.featured && <span className="featured-mark"><Sparkles size={12}/> Seleção Pixora</span>}
      {item.publicFigure && <span className="featured-mark" aria-label="Imagem ficcional gerada ou editada por IA; não comprova um encontro real" title="Imagem ficcional gerada ou editada por IA; não comprova um encontro real"><Sparkles size={12}/> Imagem ficcional de IA</span>}
    </div>
    <h3>{item.title}</h3><p>{item.description}</p>
    <div className="card-footer">
        <button className="button-soft" type="button" onClick={() => onView(item)} data-testid={`button-view-${item.id}`}>Ver prompt <ChevronRight size={14}/></button>
      <div className="card-actions">
        <button className={`icon-button${isFavorite ? ' is-favorite' : ''}`} type="button" onClick={() => onFavorite(item)} aria-label={isFavorite ? `Remover ${item.title} dos favoritos` : `Favoritar ${item.title}`} aria-pressed={isFavorite} data-testid={`button-favorite-${item.id}`}><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'}/></button>
        <button className="copy-button" type="button" onClick={() => onCopy(item)} aria-live="polite" data-testid={`button-copy-${item.id}`}>{copied ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar</>}</button>
      </div>
    </div>
  </article>;
});

const PromptGrid = memo(function PromptGrid({ items, favoriteIds, copiedPromptId, toggleFavorite, copyPrompt, viewPrompt, clearFilters }: {
  items: PromptEntry[]; favoriteIds: ReadonlySet<string>; toggleFavorite: (item: PromptEntry) => void;
  copiedPromptId: string | null; copyPrompt: (item: PromptEntry) => void; viewPrompt: (item: PromptEntry) => void; clearFilters: () => void;
}) {
  if (!items.length) return <div className="no-results" data-testid="state-no-results">
    <Search size={25}/><h3>Nenhum prompt por aqui</h3>
    <p>Tente outra palavra ou limpe os filtros para explorar a biblioteca.</p>
    <button type="button" className="button-soft" onClick={clearFilters} data-testid="button-reset-filters">Limpar busca e filtros</button>
  </div>;
  return <div className="prompt-grid" aria-live="polite">
    {items.map((item) => <PromptCard key={item.id} item={item} isFavorite={favoriteIds.has(item.id)} copied={copiedPromptId === item.id} onFavorite={toggleFavorite} onCopy={copyPrompt} onView={viewPrompt}/>)}
  </div>;
});

function AppContent() {
  const [path] = useLocation();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Todas'>('Todas');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pixora-favorites') || '[]') as string[]; } catch { return []; }
  });
  const [activePrompt, setActivePrompt] = useState<PromptEntry | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const routeCategory = categories.find((item) => item.route === path)?.name;
  const isFavorites = path === '/favoritos';
  const isHome = path === '/';
  useEffect(() => { setSelectedCategory(routeCategory ?? 'Todas'); }, [routeCategory]);

  useEffect(() => {
    try { localStorage.setItem('pixora-favorites', JSON.stringify(favorites)); } catch { /* storage may be unavailable */ }
  }, [favorites]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);
  useEffect(() => {
    if (!activePrompt) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setActivePrompt(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activePrompt]);
  useEffect(() => { setMenuOpen(false); }, [path]);

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const baseCategory = selectedCategory;
  const visiblePrompts = useMemo(() => {
    return searchablePrompts.reduce<PromptEntry[]>((matches, { item, searchText }) => {
      if (isFavorites && !favoriteIds.has(item.id)) return matches;
      if (baseCategory !== 'Todas' && item.category !== baseCategory) return matches;
      if (normalizedQuery && !searchText.includes(normalizedQuery)) return matches;
      matches.push(item);
      return matches;
    }, []);
  }, [baseCategory, favoriteIds, isFavorites, normalizedQuery]);

  const showToast = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const toggleFavorite = useCallback((item: PromptEntry) => {
    const already = favorites.includes(item.id);
    setFavorites((previous) => already ? previous.filter((id) => id !== item.id) : [...previous, item.id]);
    showToast(already ? 'Removido dos favoritos.' : 'Salvo nos seus favoritos.');
  }, [favorites, showToast]);
  const copyPrompt = useCallback(async (item: PromptEntry) => {
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(item.prompt); copied = true; } catch { /* try the legacy copy path */ }
      }
      if (!copied) {
        const field = document.createElement('textarea');
        field.value = item.prompt; field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.appendChild(field); field.select();
        copied = document.execCommand('copy'); field.remove();
      }
      if (!copied) throw new Error('Clipboard indisponível');
      setCopiedPromptId(item.id);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopiedPromptId(null), 1800);
      showToast('Prompt copiado com sucesso!');
    } catch {
      showToast('Não foi possível copiar agora. Selecione o texto do prompt para copiar.', true);
    }
  }, [showToast]);
  const clearSearchAndFilters = useCallback(() => { setQuery(''); setSelectedCategory('Todas'); }, []);
  const changePageFilter = useCallback((category: Category | 'Todas') => setSelectedCategory(category), []);
  const headingTitle = isFavorites ? 'Seus favoritos' : routeCategory || (path === '/prompts' ? 'Todos os prompts' : 'Biblioteca de prompts');
  const headingDescription = isFavorites
    ? 'Uma coleção pessoal de ideias para voltar quando a inspiração chamar.'
    : routeCategory ? categories.find((category) => category.name === routeCategory)?.description
      : 'Encontre um prompt pronto para transformar sua próxima fotografia.';

  const contentForListing = (isHome ? featuredPrompts : visiblePrompts);
  const homeFiltered = isHome && (query.length > 0 || selectedCategory !== 'Todas');

  return <div className="app-shell">
    <aside className="sidebar"><Sidebar path={path} favoritesCount={favorites.length}/></aside>
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="mobile-menu" aria-label={menuOpen ? 'Fechar navegação' : 'Abrir navegação'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-menu">{menuOpen ? <X size={18}/> : <Menu size={18}/>}</button>
          <div className="crumb"><strong>{isHome ? 'Início' : headingTitle}</strong>{!isHome && <span> / Pixora AI</span>}</div>
        </div>
        <div className="top-count"><b>{isHome ? prompts.length : isFavorites ? favorites.length : visiblePrompts.length}</b> prompts na biblioteca</div>
      </header>
      {menuOpen && <div className="mobile-nav-panel"><Sidebar path={path} favoritesCount={favorites.length} onNavigate={() => setMenuOpen(false)}/></div>}
      <main className="content">
        {isHome ? <>
          <div className="page-heading">
            <div className="eyebrow">Um universo de possibilidades</div>
            <h1>Bem-vindo à Pixora AI</h1>
            <p>Suas próximas fotos extraordinárias começam com o prompt certo.</p>
            <p style={{ marginTop: 7 }}>Explore nossa biblioteca de prompts e encontre a inspiração ideal para transformar suas fotografias com ferramentas de IA.</p>
          </div>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">Ideias que viram imagem</div>
              <h2 id="hero-title">Dê vida à sua próxima ideia.</h2>
              <p>Escolha um estilo, encontre seu prompt e leve sua criatividade para outro nível.</p>
              <Link href="/prompts" className="button-primary" data-testid="button-hero-library">Explorar biblioteca <ArrowRight size={16}/></Link>
            </div>
          </section>
          <section aria-labelledby="category-title">
            <div className="section-row"><div><h2 className="section-title" id="category-title">Encontre seu universo</h2><p className="section-subtitle">Quatro caminhos, uma ideia pronta para começar.</p></div></div>
            <CategoryCards onOpen={() => { setQuery(''); setSelectedCategory('Todas'); }}/>
          </section>
          <section aria-labelledby="search-title">
            <div className="section-row"><div><h2 className="section-title" id="search-title">O que você quer criar?</h2><p className="section-subtitle">Busque por assunto, lugar, time ou estilo.</p></div></div>
            <SearchBox value={query} onChange={setQuery} onClear={() => setQuery('')}/>
            {query && <FilterChips selected={selectedCategory} onSelect={setSelectedCategory}/>}
          </section>
          <section aria-labelledby="featured-title">
            <div className="section-row"><div><h2 className="section-title" id="featured-title">{homeFiltered ? 'Resultados da busca' : 'Escolhas para começar'}</h2><p className="section-subtitle">{homeFiltered ? `${visiblePrompts.length} ${visiblePrompts.length === 1 ? 'ideia encontrada' : 'ideias encontradas'}` : 'Prompts selecionados para acender a próxima ideia.'}</p></div>{!homeFiltered && <Link href="/prompts" className="text-link">Ver biblioteca <ArrowRight size={14}/></Link>}</div>
             <PromptGrid items={homeFiltered ? visiblePrompts : contentForListing} favoriteIds={favoriteIds} copiedPromptId={copiedPromptId} toggleFavorite={toggleFavorite} copyPrompt={copyPrompt} viewPrompt={setActivePrompt} clearFilters={clearSearchAndFilters}/>
          </section>
        </> : <>
          <div className="page-heading">
            <div className="eyebrow">{isFavorites ? 'Sua coleção' : routeCategory || 'Explore a biblioteca'}</div>
            <h1>{headingTitle}</h1><p>{headingDescription}</p>
          </div>
          {routeCategory === 'Artistas' && <div className="artist-notice"><Sparkles size={16}/><span>As sugestões com figuras públicas são composições ficcionais criadas por IA. Não representam encontros reais nem servem como prova de interação.</span></div>}
          <SearchBox value={query} onChange={setQuery} onClear={() => setQuery('')} compact/>
          <FilterChips selected={selectedCategory} onSelect={changePageFilter}/>
          {isFavorites && !favorites.length ? <div className="empty-faves" data-testid="state-empty-favorites">
            <div className="empty-faves-icon"><Bookmark size={25}/></div><h2>Seu próximo favorito ainda está por aí.</h2>
            <p>Toque no coração de qualquer prompt e ele fica guardado aqui, pronto para quando a inspiração voltar.</p>
            <Link href="/prompts" className="button-primary" data-testid="button-explore-favorites">Explorar prompts <ArrowRight size={15}/></Link>
          </div> : <>
            <div className="section-row">
              <div><h2 className="section-title">{normalizedQuery || selectedCategory !== 'Todas' ? 'Resultados' : isFavorites ? 'Sua coleção' : 'Todos os prompts'}</h2><p className="section-subtitle">{visiblePrompts.length} {visiblePrompts.length === 1 ? 'prompt encontrado' : 'prompts encontrados'}</p></div>
            </div>
             <PromptGrid items={visiblePrompts} favoriteIds={favoriteIds} copiedPromptId={copiedPromptId} toggleFavorite={toggleFavorite} copyPrompt={copyPrompt} viewPrompt={setActivePrompt} clearFilters={clearSearchAndFilters}/>
          </>}
        </>}
      </main>
    </div>
    {activePrompt && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePrompt(null); }}>
      <section className="prompt-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description">
        <div className="modal-head"><span className="tag">{activePrompt.category}</span><button type="button" className="icon-button modal-close" ref={closeRef} aria-label="Fechar detalhes do prompt" onClick={() => setActivePrompt(null)} data-testid="button-close-modal"><X size={17}/></button></div>
        <h2 id="modal-title">{activePrompt.title}</h2><p className="modal-description" id="modal-description">{activePrompt.description}</p>
        <div className="prompt-text" tabIndex={0} data-testid={`text-full-prompt-${activePrompt.id}`}>{activePrompt.prompt}</div>
        {activePrompt.publicFigure && <p className="modal-disclaimer">Composição ficcional de IA. Esta imagem não comprova um encontro real com a figura pública.</p>}
        <div className="modal-actions">
          <button type="button" className="button-primary" onClick={() => copyPrompt(activePrompt)} aria-live="polite" data-testid="button-copy-modal">{copiedPromptId === activePrompt.id ? <><Check size={15}/> Prompt copiado</> : <><Copy size={15}/> Copiar prompt completo</>}</button>
          <button type="button" className="button-soft" onClick={() => toggleFavorite(activePrompt)} aria-pressed={favorites.includes(activePrompt.id)} data-testid="button-favorite-modal"><Heart size={15} fill={favorites.includes(activePrompt.id) ? 'currentColor' : 'none'}/>{favorites.includes(activePrompt.id) ? 'Salvo nos favoritos' : 'Favoritar'}</button>
        </div>
      </section>
    </div>}
    {toast && <div role="status" aria-live="polite" className={`toast${toast.error ? ' error' : ''}`} data-testid="status-feedback">{toast.error ? <X size={16}/> : <Check size={16}/>}<span>{toast.message}</span></div>}
  </div>;
}

function FilterChips({ selected, onSelect }: { selected: Category | 'Todas'; onSelect: (category: Category | 'Todas') => void }) {
  return <div className="filter-row" role="group" aria-label="Filtrar por categoria">
    {(['Todas', ...categories.map((category) => category.name)] as (Category | 'Todas')[]).map((category) =>
      <button key={category} type="button" className={`filter-chip${selected === category ? ' selected' : ''}`} aria-pressed={selected === category} onClick={() => onSelect(category)} data-testid={`filter-${category.toLowerCase().replaceAll(' ', '-')}`}>{category}</button>)}
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={AppContent}/>
    <Route path="/edicao-de-foto" component={AppContent}/>
    <Route path="/viagem" component={AppContent}/>
    <Route path="/torcida" component={AppContent}/>
    <Route path="/artistas" component={AppContent}/>
    <Route path="/prompts" component={AppContent}/>
    <Route path="/favoritos" component={AppContent}/>
    <Route component={NotFound}/>
  </Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider>
  </QueryClientProvider>;
}

export default App;
