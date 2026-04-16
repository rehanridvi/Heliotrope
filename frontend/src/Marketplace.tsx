import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  ArrowLeft,
  Edit3,
  Plus,
  Search,
  Store,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getImageUrl } from './api';
import type { SellerStorefront, StorefrontProduct } from './marketplaceApi';
import * as mp from './marketplaceApi';
import './Marketplace.css';
import LiveChatPanel from './components/LiveChatPanel';

function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount);
}

function PublicStorefrontView({
  storefront,
  products,
  onBack,
}: {
  storefront: SellerStorefront;
  products: StorefrontProduct[];
  onBack: () => void;
}) {
  const [showLive, setShowLive] = useState(true);
  return (
    <div className="marketplace-root">
      <button type="button" className="mp-public-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to marketplace
      </button>

      <div className="mp-hero glass">
        {storefront.bannerUrl ? (
          <img
            className="mp-hero-banner"
            src={getImageUrl(storefront.bannerUrl)}
            alt=""
          />
        ) : (
          <div className="mp-hero-banner" />
        )}
        <div className="mp-hero-overlay" />
        <div className="mp-hero-content">
          {storefront.logoUrl ? (
            <img
              className="mp-hero-logo"
              src={getImageUrl(storefront.logoUrl)}
              alt=""
            />
          ) : (
            <div className="mp-hero-logo" />
          )}
          <div className="mp-hero-text">
            <h2>{storefront.storeName}</h2>
            {storefront.description ? <p>{storefront.description}</p> : null}
            {storefront.categoryTags?.length ? (
              <div className="tags" style={{ marginTop: '0.5rem' }}>
                {storefront.categoryTags.map((t) => (
                  <span key={t} className="tag occasion">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="mp-section-title">Products</h3>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowLive((v) => !v)}
        >
          {showLive ? 'Hide live chat' : 'Show live chat'}
        </button>
      </div>

      {showLive ? (
        <LiveChatPanel
          streamId={storefront._id}
          displayName="Buyer"
        />
      ) : null}

      {products.length === 0 ? (
        <div className="empty-state">
          <p>This seller has not listed any products yet.</p>
        </div>
      ) : (
        <div className="mp-product-grid">
          {products.map((p) => (
            <div key={p._id} className="mp-product-card">
              <div className="thumb">
                {p.imageUrl ? (
                  <img src={getImageUrl(p.imageUrl)} alt={p.name} />
                ) : (
                  <div className="placeholder">No image</div>
                )}
              </div>
              <div className="body">
                <h4>{p.name}</h4>
                {p.description ? (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.35rem',
                    }}
                  >
                    {p.description}
                  </p>
                ) : null}
                <div className="price">{formatMoney(p.price)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductEditorModal({
  storefrontId,
  product,
  onClose,
  onSaved,
}: {
  storefrontId: string;
  product?: StorefrontProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(
    product != null ? String(product.price) : ''
  );
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    product?.imageUrl ? getImageUrl(product.imageUrl) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setImage(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price);
    if (!name.trim() || Number.isNaN(p) || p < 0) {
      setError('Enter a name and valid price.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description);
      fd.append('price', String(p));
      if (image) fd.append('image', image);
      if (product) {
        await mp.updateStoreProduct(product._id, fd);
      } else {
        await mp.createStoreProduct(storefrontId, fd);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Could not save product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="modal-content glass"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{product ? 'Edit product' : 'Add product'}</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-group">
            <label htmlFor="p-name">Name</label>
            <input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="p-price">Price (BDT)</label>
            <input
              id="p-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="p-desc">Description</label>
            <textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Image</label>
            <label className="upload-box" htmlFor="p-img">
              {preview ? (
                <img className="preview-img" src={preview} alt="" />
              ) : (
                <span className="upload-placeholder">Upload image</span>
              )}
            </label>
            <input
              id="p-img"
              type="file"
              accept="image/*"
              hidden
              onChange={handleImage}
            />
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Marketplace() {
  const [tab, setTab] = useState<'browse' | 'manage'>('browse');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [stores, setStores] = useState<SellerStorefront[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [publicStorefront, setPublicStorefront] =
    useState<SellerStorefront | null>(null);
  const [publicProducts, setPublicProducts] = useState<StorefrontProduct[]>(
    []
  );
  const [publicLoading, setPublicLoading] = useState(false);

  const [myLoading, setMyLoading] = useState(false);
  const [myStorefront, setMyStorefront] = useState<SellerStorefront | null>(
    null
  );
  const [myProducts, setMyProducts] = useState<StorefrontProduct[]>([]);
  const [manageError, setManageError] = useState('');

  const [sfName, setSfName] = useState('');
  const [sfDesc, setSfDesc] = useState('');
  const [sfTags, setSfTags] = useState('');
  const [sfLogo, setSfLogo] = useState<File | null>(null);
  const [sfBanner, setSfBanner] = useState<File | null>(null);
  const [sfSubmitting, setSfSubmitting] = useState(false);
  const [showSellerLive, setShowSellerLive] = useState(true);

  const [productModal, setProductModal] = useState<StorefrontProduct | null | 'new'>(
    null
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await mp.listStorefrontSummaries(
        debouncedQ || undefined
      );
      setStores(data);
    } catch (e) {
      console.error(e);
    } finally {
      setListLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedSlug) {
      setPublicStorefront(null);
      setPublicProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPublicLoading(true);
      try {
        const d = await mp.getStorefrontPublic(selectedSlug);
        if (!cancelled) {
          setPublicStorefront(d.storefront);
          setPublicProducts(d.products);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPublicStorefront(null);
          setPublicProducts([]);
        }
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const loadMine = useCallback(async () => {
    setMyLoading(true);
    setManageError('');
    try {
      const d = await mp.getMyStorefront();
      setMyStorefront(d.storefront);
      setMyProducts(d.products);
      if (d.storefront) {
        setSfName(d.storefront.storeName);
        setSfDesc(d.storefront.description ?? '');
        setSfTags(d.storefront.categoryTags?.join(', ') ?? '');
      } else {
        setSfName('');
        setSfDesc('');
        setSfTags('');
      }
      setSfLogo(null);
      setSfBanner(null);
    } catch (e: unknown) {
      console.error(e);
      const ax = e as {
        response?: { data?: { error?: string }; status?: number };
        message?: string;
      };
      setManageError(
        ax.response?.data?.error ??
          (ax.response?.status
            ? `Request failed (${ax.response.status}).`
            : null) ??
          ax.message ??
          'Could not load your storefront.'
      );
    } finally {
      setMyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'manage') loadMine();
  }, [tab, loadMine]);

  const submitStorefront = async (e: FormEvent) => {
    e.preventDefault();
    if (!sfName.trim()) return;
    setSfSubmitting(true);
    setManageError('');
    const buildStorefrontFormData = () => {
      const fd = new FormData();
      fd.append('storeName', sfName.trim());
      fd.append('description', sfDesc);
      fd.append('categoryTags', sfTags);
      if (sfLogo) fd.append('logo', sfLogo);
      if (sfBanner) fd.append('banner', sfBanner);
      return fd;
    };
    try {
      if (myStorefront) {
        await mp.updateStorefront(myStorefront._id, buildStorefrontFormData());
      } else {
        await mp.createStorefront(buildStorefrontFormData());
      }
      await loadMine();
      await refreshList();
    } catch (err: unknown) {
      const ax = err as {
        response?: {
          status?: number;
          data?: { error?: string; storefrontId?: string };
        };
      };
      if (ax.response?.status === 409 && ax.response?.data?.storefrontId) {
        try {
          await mp.updateStorefront(
            ax.response.data.storefrontId,
            buildStorefrontFormData()
          );
          await loadMine();
          await refreshList();
        } catch (retryErr: unknown) {
          const r = retryErr as { response?: { data?: { error?: string } } };
          setManageError(
            r.response?.data?.error ??
              'Could not update your existing storefront.'
          );
        }
      } else if (ax.response?.status === 409) {
        setManageError(
          ax.response?.data?.error ??
            'You already have a storefront. Saving as update.'
        );
        await loadMine();
        await refreshList();
      } else {
        const msg = ax.response?.data?.error;
        setManageError(
          typeof msg === 'string' && msg.length
            ? msg
            : 'Could not save storefront.'
        );
      }
    } finally {
      setSfSubmitting(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await mp.deleteStoreProduct(id);
      await loadMine();
      await refreshList();
    } catch (e) {
      console.error(e);
      setManageError('Delete failed.');
    }
  };

  if (selectedSlug) {
    if (publicLoading || !publicStorefront) {
      return (
        <div className="marketplace-root">
          <button
            type="button"
            className="mp-public-back"
            onClick={() => setSelectedSlug(null)}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="loader">Loading storefront…</div>
        </div>
      );
    }
    return (
      <PublicStorefrontView
        storefront={publicStorefront}
        products={publicProducts}
        onBack={() => setSelectedSlug(null)}
      />
    );
  }

  return (
    <div className="marketplace-root">
      <div className="marketplace-tabs glass">
        <button
          type="button"
          className={tab === 'browse' ? 'active' : ''}
          onClick={() => {
            setTab('browse');
          }}
        >
          Browse
        </button>
        <button
          type="button"
          className={tab === 'manage' ? 'active' : ''}
          onClick={() => setTab('manage')}
        >
          My storefront
        </button>
      </div>

      {tab === 'browse' ? (
        <>
          <div className="marketplace-toolbar">
            <div className="search-bar glass">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search stores or tags…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          {listLoading ? (
            <div className="loader">Loading storefronts…</div>
          ) : stores.length === 0 ? (
            <div className="empty-state">
              <Store size={40} style={{ marginBottom: '0.5rem' }} />
              <h3>No storefronts yet</h3>
              <p>Open “My storefront” to create the first one.</p>
            </div>
          ) : (
            <div className="mp-store-grid">
              {stores.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  className="mp-store-card"
                  onClick={() => setSelectedSlug(s.slug)}
                >
                  <div
                    className="mp-store-card-banner"
                    style={
                      s.bannerUrl
                        ? {
                            backgroundImage: `url(${getImageUrl(s.bannerUrl)})`,
                          }
                        : undefined
                    }
                  />
                  <div className="mp-store-card-body">
                    {s.logoUrl ? (
                      <img
                        className="mp-store-card-logo"
                        src={getImageUrl(s.logoUrl)}
                        alt=""
                      />
                    ) : (
                      <div className="mp-store-card-logo" />
                    )}
                    <div>
                      <h3>{s.storeName}</h3>
                      {s.description ? <p>{s.description}</p> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {manageError ? <p className="error-banner">{manageError}</p> : null}
          {myLoading ? (
            <div className="loader">Loading your storefront…</div>
          ) : (
            <div className="mp-manage-layout">
              <div className="mp-panel glass">
                <h3>{myStorefront ? 'Edit storefront' : 'Create storefront'}</h3>
                <form onSubmit={submitStorefront}>
                  <div className="form-group">
                    <label htmlFor="sf-name">Store name</label>
                    <input
                      id="sf-name"
                      value={sfName}
                      onChange={(e) => setSfName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-desc">Business description</label>
                    <textarea
                      id="sf-desc"
                      rows={4}
                      value={sfDesc}
                      onChange={(e) => setSfDesc(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-tags">Category tags (comma-separated)</label>
                    <input
                      id="sf-tags"
                      value={sfTags}
                      onChange={(e) => setSfTags(e.target.value)}
                      placeholder="e.g. handmade, jewelry, dhaka"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-logo">Logo</label>
                    <input
                      id="sf-logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setSfLogo(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-banner">Banner image</label>
                    <input
                      id="sf-banner"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setSfBanner(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={sfSubmitting}
                  >
                    {sfSubmitting
                      ? 'Saving…'
                      : myStorefront
                        ? 'Update storefront'
                        : 'Create storefront'}
                  </button>
                </form>
              </div>

              <div className="mp-panel glass">
                {myStorefront ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Live comments</h3>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setShowSellerLive((v) => !v)}
                      >
                        {showSellerLive ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {showSellerLive ? (
                      <LiveChatPanel
                        streamId={myStorefront._id}
                        displayName="Seller"
                      />
                    ) : null}
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <h3>Products</h3>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!myStorefront}
                    onClick={() => setProductModal('new')}
                  >
                    <Plus size={18} /> Add
                  </button>
                </div>
                {!myStorefront ? (
                  <p style={{ color: 'var(--text-muted)' }}>
                    Create your storefront first, then add products.
                  </p>
                ) : myProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>
                    No products yet. Click Add to list one with image, price, and
                    description.
                  </p>
                ) : (
                  <div>
                    {myProducts.map((p) => (
                      <div key={p._id} className="mp-product-row">
                        {p.imageUrl ? (
                          <img
                            className="mini"
                            src={getImageUrl(p.imageUrl)}
                            alt=""
                          />
                        ) : (
                          <div className="mini placeholder" />
                        )}
                        <div className="meta">
                          <h4>{p.name}</h4>
                          <div className="price">{formatMoney(p.price)}</div>
                        </div>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setProductModal(p)}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon delete"
                            onClick={() => deleteProduct(p._id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {productModal && myStorefront ? (
          <ProductEditorModal
            key={
              productModal === 'new' ? 'new-product' : productModal._id
            }
            storefrontId={myStorefront._id}
            product={productModal === 'new' ? undefined : productModal}
            onClose={() => setProductModal(null)}
            onSaved={() => {
              loadMine();
              refreshList();
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
