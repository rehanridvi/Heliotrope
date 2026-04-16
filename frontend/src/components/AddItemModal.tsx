import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { createItem, updateItem } from '../api';
import type { ClosetItem, ClosetItemType } from '../api';

const CLOSET_ITEM_TYPES: ClosetItemType[] = [
  'clothes',
  'accessories',
  'bags',
  'glasses',
  'shoes',
  'makeup',
];

interface AddItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editItem?: ClosetItem;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ onClose, onSuccess, editItem }) => {
  const [name, setName] = useState(editItem?.name ?? '');
  const [type, setType] = useState<ClosetItemType>(editItem?.type ?? 'clothes');
  const [brand, setBrand] = useState(editItem?.brand ?? '');
  const [colors, setColors] = useState(editItem?.colors?.join(', ') ?? '');
  const [occasions, setOccasions] = useState(editItem?.occasions?.join(', ') ?? '');
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(editItem?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !type) return;

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('type', type);
      formData.append('brand', brand);
      formData.append('colors', colors);
      formData.append('occasions', occasions);
      formData.append('notes', notes);
      if (image) {
        formData.append('image', image);
      }

      if (editItem) {
        await updateItem(editItem._id, formData);
      } else {
        await createItem(formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Failed to create item:', err);
      setError('Could not save this item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="modal-content glass"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h2>{editItem ? 'Edit Closet Item' : 'Add Closet Item'}</h2>
        <button className="btn-close" onClick={onClose}><X size={24} /></button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group image-upload">
            <label>Item Image</label>
            <div className="upload-box" onClick={() => document.getElementById('imageInput')?.click()}>
              {preview ? (
                <img src={preview} alt="Preview" className="preview-img" />
              ) : (
                <div className="upload-placeholder">
                  <Upload size={32} />
                  <span>Click to upload photo</span>
                </div>
              )}
              <input 
                id="imageInput"
                type="file" 
                hidden 
                accept="image/*"
                onChange={handleImageChange} 
              />
            </div>
          </div>

          <div className="form-fields">
            <div className="form-group">
              <label>Item Name</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. My Favorite Denim Jacket" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={type} onChange={(e) => setType(e.target.value as ClosetItemType)}>
                {CLOSET_ITEM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Brand (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Levi's, Zara" 
                value={brand} 
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Colors (Comma separated)</label>
              <input 
                type="text" 
                placeholder="e.g. Blue, Navy, Indigo" 
                value={colors} 
                onChange={(e) => setColors(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Occasions (Comma separated)</label>
              <input 
                type="text" 
                placeholder="e.g. Casual, Party, Formal" 
                value={occasions} 
                onChange={(e) => setOccasions(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea 
                placeholder="Any extra details..." 
                rows={2}
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : editItem ? 'Save Changes' : 'Add to Closet'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AddItemModal;
