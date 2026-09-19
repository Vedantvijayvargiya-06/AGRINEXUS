import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { X, Upload, Thermometer, Calendar, MapPin, Scale, Sparkles, CheckCircle2 } from 'lucide-react';

const CROPS = [
  { id: 'Tomato', name: 'Tomato', name_hi: 'टमाटर', defaultTemp: 28, shelfLife: '6 Days', icon: '🍅' },
  { id: 'Onion', name: 'Onion', name_hi: 'प्याज', defaultTemp: 26, shelfLife: '30 Days', icon: '🧅' },
  { id: 'Potato', name: 'Potato', name_hi: 'आलू', defaultTemp: 24, shelfLife: '40 Days', icon: '🥔' },
  { id: 'Mango', name: 'Mango', name_hi: 'आम', defaultTemp: 29, shelfLife: '7 Days', icon: '🥭' },
  { id: 'Apple', name: 'Apple', name_hi: 'सेब', defaultTemp: 20, shelfLife: '21 Days', icon: '🍎' },
  { id: 'Banana', name: 'Banana', name_hi: 'केला', defaultTemp: 27, shelfLife: '5 Days', icon: '🍌' }
];

export default function AddBatchModal({ isOpen, onClose, onBatchAdded }) {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();
  const { effectiveOnline, queueAction } = useOfflineSync();

  const [crop, setCrop] = useState('Tomato');
  const [variety, setVariety] = useState('Arka Rakshak (Hybrid)');
  const [quantityKg, setQuantityKg] = useState(1000);
  const [ambientTemp, setAmbientTemp] = useState(28);
  const [location, setLocation] = useState('Kolar Mandi Farm Gate');
  const [locality, setLocality] = useState('Kolar');
  const [storageType, setStorageType] = useState('Ambient Farm Shed');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg('');

    const payload = {
      farmer_id: currentUser.id,
      crop,
      variety,
      quantity_kg: parseFloat(quantityKg),
      ambient_temp_c: parseFloat(ambientTemp),
      location,
      locality,
      storage_type: storageType,
      photo_url: photoPreview || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
      harvest_time: new Date().toISOString()
    };

    if (!effectiveOnline) {
      // Offline mode: queue action locally (FR-1.6, NFR-4.2)
      queueAction('CREATE_BATCH', payload);
      setSuccessMsg('Harvest registered locally in Offline Queue! Will sync automatically when connected.');
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1400);
      return;
    }

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Batch registered! Digital Twin generated (Quality: ${data.digital_twin?.current_quality}%).`);
        setTimeout(() => {
          setIsSubmitting(false);
          onBatchAdded(data);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to add batch:', err);
      // Fallback queue
      queueAction('CREATE_BATCH', payload);
      setSuccessMsg('Harvest registered offline.');
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1200);
    }
  };

  const selectedCropObj = CROPS.find(c => c.id === crop) || CROPS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span>{t('add_new_batch')}</span>
            </h3>
            <p className="text-xs text-slate-500">Capture harvest parameters for live digital twin modeling</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Crop Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Select Crop Type</label>
            <div className="grid grid-cols-3 gap-2">
              {CROPS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCrop(c.id);
                    setAmbientTemp(c.defaultTemp);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all ${
                    crop === c.id
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{lang === 'hi' ? c.name_hi : c.name}</p>
                    <p className="text-[10px] text-slate-500">{c.shelfLife}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Variety */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quantity (Kilograms)</span>
              </label>
              <input
                type="number"
                min="50"
                step="50"
                required
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Produce Variety / Grade</label>
              <input
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Arka Rakshak, Desi Standard"
              />
            </div>
          </div>

          {/* Ambient Temperature Slider */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                <span>Current Ambient Temperature:</span>
              </label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                ambientTemp > 30 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {ambientTemp}°C {ambientTemp > 30 ? '(Accelerated Decay)' : '(Optimal)'}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="42"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Decay doubles every 10°C above 20°C heuristic (Q10 rule).
            </p>
          </div>

          {/* Location & Storage type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Locality / Cluster Zone</span>
              </label>
              <select
                value={locality}
                onChange={(e) => {
                  setLocality(e.target.value);
                  setLocation(`${e.target.value} Farm Cluster`);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Kolar">Kolar Hub (Karnataka)</option>
                <option value="Malur">Malur Village (Kolar)</option>
                <option value="Bangarapet">Bangarapet Zone</option>
                <option value="Chintamani">Chintamani Belt</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Facility</label>
              <select
                value={storageType}
                onChange={(e) => setStorageType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Ambient Farm Shed">Ambient Farm Shed</option>
                <option value="Shaded Packhouse">Shaded Packhouse</option>
                <option value="Zero Energy Cool Chamber">Zero Energy Cool Chamber (ZECC)</option>
                <option value="FPO Cold Storage Unit">FPO Cold Storage Unit</option>
              </select>
            </div>
          </div>

          {/* Optional Produce Photo upload (FR-3.2) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Produce Photograph (Optional quality grading input)</span>
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-xs" />
              )}
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Computing Model...' : 'Register & Compute Digital Twin'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
