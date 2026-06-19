import { useCallback, useEffect, useState } from 'react';
import {
  AdminUnauthorizedError,
  createAdminRecommendedLive,
  deleteAdminRecommendedLive,
  fetchAdminMe,
  fetchAdminRecommendedLives,
  logoutAdmin,
  reorderAdminRecommendedLives,
  searchAdminYoutubeChannels,
  updateAdminRecommendedLive,
  type AdminRecommendedLive,
  type RecommendedLiveInput,
} from '../services/adminApi';
import type { YoutubeChannelResult } from '../services/youtubeResolver';
import './AdminLivesPage.css';

type FormState = {
  channelId: string;
  description: string;
  displayName: string;
  enabled: boolean;
  id?: string;
  sortOrder: string;
  thumbnailUrl: string;
  videoId: string;
};

const emptyForm: FormState = {
  channelId: '',
  description: '',
  displayName: '',
  enabled: true,
  sortOrder: '100',
  thumbnailUrl: '',
  videoId: '',
};

const goToLogin = () => {
  window.location.hash = '/admin/login';
};

const goToHome = () => {
  window.location.hash = '/';
};

const toFormState = (item: AdminRecommendedLive): FormState => ({
  channelId: item.channelId,
  description: item.description ?? '',
  displayName: item.displayName,
  enabled: item.enabled,
  id: item.id,
  sortOrder: String(item.sortOrder),
  thumbnailUrl: item.thumbnailUrl ?? '',
  videoId: item.videoId ?? '',
});

const toInput = (form: FormState): RecommendedLiveInput => ({
  channelId: form.channelId.trim(),
  description: form.description.trim(),
  displayName: form.displayName.trim(),
  enabled: form.enabled,
  sortOrder: Number(form.sortOrder || 100),
  thumbnailUrl: form.thumbnailUrl.trim(),
  videoId: form.videoId.trim(),
});

const AdminLivesPage = () => {
  const [items, setItems] = useState<AdminRecommendedLive[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YoutubeChannelResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof AdminUnauthorizedError) {
      goToLogin();
      return;
    }

    console.warn('admin-lives:', err);
    setError(fallback);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const [admin, nextItems] = await Promise.all([fetchAdminMe(), fetchAdminRecommendedLives()]);
      if (!admin) {
        goToLogin();
        return;
      }

      setItems(nextItems);
      setError(null);
    } catch (err) {
      handleError(err, 'Nao foi possivel carregar as recomendacoes.');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateFormField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setNotice(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.displayName.trim() || !form.channelId.trim()) {
      setError('Nome e channelId sao obrigatorios.');
      return;
    }

    setIsSaving(true);

    try {
      if (form.id) {
        await updateAdminRecommendedLive(form.id, toInput(form));
        setNotice('Recomendacao atualizada.');
      } else {
        await createAdminRecommendedLive(toInput(form));
        setNotice('Recomendacao criada.');
      }

      setForm(emptyForm);
      await loadItems();
    } catch (err) {
      handleError(err, 'Nao foi possivel salvar a recomendacao.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const results = await searchAdminYoutubeChannels(cleanQuery);
      setSearchResults(results);
      if (results.length === 0) setNotice('Nenhum canal encontrado.');
    } catch (err) {
      handleError(err, 'Nao foi possivel buscar canais.');
    } finally {
      setIsSearching(false);
    }
  };

  const applySearchResult = (result: YoutubeChannelResult) => {
    setForm((current) => ({
      ...current,
      channelId: result.id,
      description: current.description || result.description,
      displayName: current.displayName || result.title,
      thumbnailUrl: current.thumbnailUrl || result.thumbnail || '',
    }));
  };

  const handleEdit = (item: AdminRecommendedLive) => {
    setForm(toFormState(item));
    setNotice(null);
    window.scrollTo({ behavior: 'smooth', top: 0 });
  };

  const handleToggle = async (item: AdminRecommendedLive) => {
    try {
      await updateAdminRecommendedLive(item.id, { enabled: !item.enabled });
      await loadItems();
    } catch (err) {
      handleError(err, 'Nao foi possivel alterar o status.');
    }
  };

  const handleDelete = async (item: AdminRecommendedLive) => {
    if (!window.confirm(`Remover ${item.displayName}?`)) return;

    try {
      await deleteAdminRecommendedLive(item.id);
      await loadItems();
      if (form.id === item.id) setForm(emptyForm);
    } catch (err) {
      handleError(err, 'Nao foi possivel remover a recomendacao.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];

    try {
      await reorderAdminRecommendedLives(
        nextItems.map((item, itemIndex) => ({
          id: item.id,
          sortOrder: (itemIndex + 1) * 10,
        })),
      );
      await loadItems();
    } catch (err) {
      handleError(err, 'Nao foi possivel reordenar.');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      goToLogin();
    }
  };

  return (
    <main className="admin-lives-page">
      <header className="admin-lives-header">
        <div>
          <span className="admin-kicker">Admin</span>
          <h1>Lives recomendadas</h1>
        </div>
        <div className="admin-header-actions">
          <button type="button" onClick={goToHome}>App</button>
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <section className="admin-lives-layout">
        <div className="admin-lives-panel">
          <form className="admin-live-form" onSubmit={handleSubmit}>
            <div className="admin-panel-heading">
              <h2>{form.id ? 'Editar' : 'Nova recomendacao'}</h2>
              {form.id && <button type="button" onClick={resetForm}>Nova</button>}
            </div>

            <label>
              Nome
              <input
                onChange={(event) => updateFormField('displayName', event.target.value)}
                required
                value={form.displayName}
              />
            </label>

            <label>
              Channel ID
              <input
                onChange={(event) => updateFormField('channelId', event.target.value)}
                pattern="^UC[a-zA-Z0-9_-]{22}$"
                required
                value={form.channelId}
              />
            </label>

            <label>
              Video ID
              <input
                onChange={(event) => updateFormField('videoId', event.target.value)}
                pattern="^[a-zA-Z0-9_-]{11}$"
                value={form.videoId}
              />
            </label>

            <label>
              Thumbnail URL
              <input
                onChange={(event) => updateFormField('thumbnailUrl', event.target.value)}
                type="url"
                value={form.thumbnailUrl}
              />
            </label>

            <label>
              Descricao
              <textarea
                maxLength={500}
                onChange={(event) => updateFormField('description', event.target.value)}
                rows={4}
                value={form.description}
              />
            </label>

            <div className="admin-live-form-row">
              <label>
                Ordem
                <input
                  min={0}
                  onChange={(event) => updateFormField('sortOrder', event.target.value)}
                  type="number"
                  value={form.sortOrder}
                />
              </label>

              <label className="admin-toggle">
                <input
                  checked={form.enabled}
                  onChange={(event) => updateFormField('enabled', event.target.checked)}
                  type="checkbox"
                />
                Ativa
              </label>
            </div>

            {error && <p className="admin-message admin-message--error">{error}</p>}
            {notice && <p className="admin-message">{notice}</p>}

            <button className="admin-primary-button" disabled={isSaving} type="submit">
              {isSaving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Criar recomendacao'}
            </button>
          </form>

          <form className="admin-channel-search" onSubmit={handleSearch}>
            <div className="admin-panel-heading">
              <h2>Buscar canal</h2>
            </div>
            <div className="admin-search-row">
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, @handle ou palavra-chave"
                type="search"
                value={query}
              />
              <button disabled={isSearching} type="submit">
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="admin-search-results">
                {searchResults.map((result) => (
                  <article key={result.id} className="admin-search-result">
                    {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span>{result.title.slice(0, 2)}</span>}
                    <div>
                      <strong>{result.title}</strong>
                      <small>{result.id}</small>
                    </div>
                    <button type="button" onClick={() => applySearchResult(result)}>Usar</button>
                  </article>
                ))}
              </div>
            )}
          </form>
        </div>

        <section className="admin-lives-list" aria-busy={isLoading}>
          {isLoading ? (
            <p className="admin-empty">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="admin-empty">Nenhuma recomendacao cadastrada.</p>
          ) : (
            items.map((item, index) => (
              <article className={item.enabled ? 'admin-live-card' : 'admin-live-card disabled'} key={item.id}>
                <div className="admin-live-thumb">
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>{item.displayName.slice(0, 2)}</span>}
                </div>
                <div className="admin-live-body">
                  <div className="admin-live-title-row">
                    <h2>{item.displayName}</h2>
                    <span>{item.enabled ? 'Ativa' : 'Inativa'}</span>
                  </div>
                  <p>{item.description || 'Sem descricao.'}</p>
                  <code>{item.channelId}{item.videoId ? ` / ${item.videoId}` : ''}</code>
                </div>
                <div className="admin-live-actions">
                  <button disabled={index === 0} type="button" onClick={() => handleMove(index, -1)}>Subir</button>
                  <button disabled={index === items.length - 1} type="button" onClick={() => handleMove(index, 1)}>Descer</button>
                  <button type="button" onClick={() => handleToggle(item)}>{item.enabled ? 'Desativar' : 'Ativar'}</button>
                  <button type="button" onClick={() => handleEdit(item)}>Editar</button>
                  <button className="danger" type="button" onClick={() => handleDelete(item)}>Remover</button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
};

export default AdminLivesPage;
