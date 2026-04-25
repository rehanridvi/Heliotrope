import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit3, ShoppingBag, X } from 'lucide-react';
import { getClosetItems, deleteClosetItem, createClosetItem, updateClosetItem } from '../services/closetService';
import { useAuth } from '../context/AuthContext';

const CLOSET_ITEM_TYPES = ['clothes', 'accessories', 'bags', 'glasses', 'shoes', 'makeup'];

type ClosetItem = {
  _id: string;
  name: string;
  type: string;
  colors: string[];
  brand?: string;
  occasions: string[];
  imageUrl?: string;
  notes?: string;
};

const DigitalClosetPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
    try { setLoading(true); setError(''); const data = await getClosetItems(selectedType); setItems(data); } catch { setError('Could not load closet items.'); } finally { setLoading(false); }
  }, [selectedType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item?')) return;
    try { await deleteClosetItem(id); setItems(items.filter((i) => i._id !== id)); } catch { setError('Failed to delete item.'); }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.colors.some((c) => c.toLowerCase().includes(searchText.toLowerCase())) ||
    item.occasions.some((o) => o.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <div className="dash-wrap">
      <div className="dash-header"><h1>My Digital Closet</h1><p className="muted">Welcome, {user?.name}!</p></div>

      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#020617', border: '1px solid #1f2937', borderRadius: 999, padding: '0.4rem 1rem' }}>
            <Search size={16} color="#6b7280" />
            <input type="text" placeholder="Search items..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#f9fafb', fontSize: '0.9rem', outline: 'none' }} />
          </div>
          <button className="btn-primary" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus size={16} /> Add Item</button>
        </div>
        <div className="tabs">
          <button className={`tab ${selectedType === undefined ? 'active' : ''}`} onClick={() => setSelectedType(undefined)}>All</button>
          {CLOSET_ITEM_TYPES.map((t) => (
            <button key={t} className={`tab ${selectedType === t ? 'active' : ''}`} onClick={() => setSelectedType(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p className="muted">Loading closet items...</p>
      ) : filteredItems.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <ShoppingBag size={48} color="#1f2937" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No items found</h3>
          <p className="muted">Start building your digital closet by adding your first item</p>
        </div>
      ) : (
        <div className="closet-grid">
          {filteredItems.map((item) => (
            <div key={item._id} className="closet-card">
              <div className="closet-card-img">
                {item.imageUrl ? <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `http://localhost:5000${item.imageUrl}`} alt={item.name} /> : <ShoppingBag size={32} />}
              </div>
              <div className="closet-card-body">
                <div className="closet-card-title">{item.name}</div>
                {item.brand && <div className="closet-card-meta">{item.brand}</div>}
                <div>
                  {item.colors.map((c) => <span key={c} className="closet-tag">{c}</span>)}
                  {item.occasions.map((o) => <span key={o} className="closet-tag" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{o}</span>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span className="closet-card-meta" style={{ textTransform: 'capitalize' }}>{item.type}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="navbar-icon-btn" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}><Edit3 size={14} /></button>
                    <button className="navbar-icon-btn" onClick={() => handleDelete(item._id)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && <ClosetItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchItems} editItem={editingItem} />}
    </div>
  );
};

const ClosetItemModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void; editItem: ClosetItem | null }> = ({ onClose, onSuccess, editItem }) => {
  const [name, setName] = useState(editItem?.name || '');
  const [type, setType] = useState(editItem?.type || 'clothes');
  const [brand, setBrand] = useState(editItem?.brand || '');
  const [colors, setColors] = useState(editItem?.colors.join(', ') || '');
  const [occasions, setOccasions] = useState(editItem?.occasions.join(', ') || '');
  const [notes, setNotes] = useState(editItem?.notes || '');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('type', type);
      formData.append('brand', brand);
      formData.append('colors', JSON.stringify(colors.split(',').map((c) => c.trim()).filter(Boolean)));
      formData.append('occasions', JSON.stringify(occasions.split(',').map((c) => c.trim()).filter(Boolean)));
      formData.append('notes', notes);
      if (image) formData.append('image', image);

      if (editItem) { await updateClosetItem(editItem._id, formData); }
      else { await createClosetItem(formData); }
      onSuccess(); onClose();
    } catch { alert('Failed to save item.'); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editItem ? 'Edit Item' : 'Add New Item'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Type
            <select value={type} onChange={(e) => setType(e.target.value)} required>
              {CLOSET_ITEM_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>)}
            </select>
          </label>
          <label>Brand<input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
          <label>Colors (comma separated)<input type="text" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="red, blue, white" /></label>
          <label>Occasions (comma separated)<input type="text" value={occasions} onChange={(e) => setOccasions(e.target.value)} placeholder="casual, work, party" /></label>
          <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
          <label>Image<input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} /></label>
          <button type="submit" className="auth-submit" disabled={saving}>{saving ? 'Saving...' : editItem ? 'Update' : 'Add Item'}</button>
        </form>
      </div>
    </div>
  );
};

export default DigitalClosetPage;

