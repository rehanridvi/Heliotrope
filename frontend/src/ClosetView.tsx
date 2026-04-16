import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit3, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItems, deleteItem, getImageUrl } from './api';
import type { ClosetItem, ClosetItemType } from './api';
import AddItemModal from './components/AddItemModal';
import './App.css';

const CLOSET_ITEM_TYPES: ClosetItemType[] = [
  'clothes',
  'accessories',
  'bags',
  'glasses',
  'shoes',
  'makeup',
];

export default function ClosetView() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems();
  }, [selectedType]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getItems(selectedType);
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setError('Could not load closet items.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(id);
        setItems(items.filter((i) => i._id !== id));
      } catch (err) {
        console.error('Delete failed:', err);
        setError('Delete failed. Please try again.');
      }
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      item.name,
      item.brand ?? '',
      ...(item.colors ?? []),
      ...(item.occasions ?? []),
      item.type,
      item.notes ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <>
      <header className="glass">
        <div className="header-content">
          <div className="logo">
            <ShoppingBag className="primary-icon" />
            <h1>Digital Closet</h1>
          </div>
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={20} /> Add New Item
          </button>
        </div>
      </header>

      <main>
        <div className="sidebar">
          <h3>Categories</h3>
          <ul>
            <li
              className={!selectedType ? 'active' : ''}
              onClick={() => setSelectedType(undefined)}
            >
              All Items
            </li>
            {CLOSET_ITEM_TYPES.map((type) => (
              <li
                key={type}
                className={selectedType === type ? 'active' : ''}
                onClick={() => setSelectedType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </li>
            ))}
          </ul>
        </div>

        <section className="dashboard">
          <div className="dashboard-header">
            <h2>
              {selectedType
                ? `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`
                : 'All Items'}
            </h2>
            <div className="search-bar glass">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search closet..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="error-banner">{error}</p>}

          {loading ? (
            <div className="loader">Loading your closet...</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <h3>No items found</h3>
              <p>
                {searchText
                  ? 'Try a different search keyword.'
                  : 'Add your first item to get started.'}
              </p>
              <button className="btn-primary" onClick={handleOpenAdd}>
                <Plus size={18} /> Add Item
              </button>
            </div>
          ) : (
            <div className="item-grid">
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item._id}
                    className="card fade-in"
                  >
                    <div className="card-image">
                      {item.imageUrl ? (
                        <img src={getImageUrl(item.imageUrl)} alt={item.name} />
                      ) : (
                        <div className="placeholder">No Image</div>
                      )}
                      <div className="card-badge">{item.type}</div>
                    </div>
                    <div className="card-body">
                      <h3>{item.name}</h3>
                      {item.brand && <p className="brand">{item.brand}</p>}
                      <div className="tags">
                        {item.colors?.map((c) => (
                          <span key={c} className="tag color">
                            {c}
                          </span>
                        ))}
                        {item.occasions?.map((o) => (
                          <span key={o} className="tag occasion">
                            {o}
                          </span>
                        ))}
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="btn-icon delete"
                          onClick={() => handleDelete(item._id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <AddItemModal
              onClose={() => setIsModalOpen(false)}
              editItem={editingItem ?? undefined}
              onSuccess={() => {
                setIsModalOpen(false);
                setEditingItem(null);
                fetchItems();
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
