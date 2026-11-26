import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { apiFetch } from '../utils/api';
import { X, Upload, Thermometer, Calendar, MapPin, Scale, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
  const { currentUser, token } = useAuth();
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
  const [errorMsg, setErrorMsg] = useState('');

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
    if (isSubmitting) return; // Prevent accidental duplicate submission
    setErrorMsg('');
    setSuccessMsg('');

    // Frontend validation
    const qty = parseFloat(quantityKg);
    if (!quantityKg || isNaN(qty) || qty <= 0) {
      setErrorMsg('Please enter a valid harvest quantity greater than 0 kg.');
      return;
    }
    if (qty > 1000000) {
      setErrorMsg('Harvest quantity cannot exceed 1,000,000 kg.');
      return;
    }

    const temp = parseFloat(ambientTemp);
    if (isNaN(temp) || temp < -20 || temp > 65) {
      setErrorMsg('Ambient temperature must be between -20°C and 65°C.');
      return;
    }

    if (!crop) {
      setErrorMsg('Please select a valid crop type.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      farmer_id: currentUser?.id,
      crop,
      variety,
      quantity_kg: qty,
      ambient_temp_c: temp,
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
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await apiFetch('/api/batches', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Batch ${data.batch_code || ''} registered! Digital Twin generated (Quality: ${data.digital_twin?.current_quality}%).`);
        setTimeout(() => {
          setIsSubmitting(false);
          // Reset form fields on success only
          setQuantityKg(1000);
          setVariety('Arka Rakshak (Hybrid)');
          setPhotoPreview(null);
          setErrorMsg('');
          onBatchAdded(data);
          onClose();
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || `Registration failed with server status ${res.status}.`);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Failed to add batch:', err);
      if (!effectiveOnline) {
        queueAction('CREATE_BATCH', payload);
        setSuccessMsg('Harvest registered offline in local queue.');
        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 1200);
      } else {
        setErrorMsg(err.message || 'Network error occurred while registering harvest. Please try again.');
        setIsSubmitting(false);
      }
    }
  };

  const selectedCropObj = CROPS.find(c => c.id === crop) || CROPS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="truncate">{t('add_new_batch')}</span>
            </h3>
            <p className="text-xs text-slate-500">Capture harvest parameters for live digital twin modeling</p>
          </div>
          <button type="button" aria-label="Close add batch modal" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center space-x-2 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Crop Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Select Crop Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CROPS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCrop(c.id);
                    setAmbientTemp(c.defaultTemp);
                  }}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all min-w-0 ${
                    crop === c.id
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xl sm:text-2xl shrink-0">{c.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs truncate">{lang === 'hi' ? c.name_hi : c.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.shelfLife}</p>
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
                min="1"
                step="any"
                required
                value={quantityKg}
                onChange={(e) => {
                  setQuantityKg(e.target.value);
                  setErrorMsg('');
                }}
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
            <div className="flex flex-wrap justify-between items-center gap-1.5 mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Current Ambient Temperature:</span>
              </label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
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
              onChange={(e) => {
                setAmbientTemp(parseFloat(e.target.value));
                setErrorMsg('');
              }}
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
              <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Produce Photograph (Optional quality grading input)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="w-full min-w-0 max-w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm shrink-0" />
              )}
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md transition-all ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Computing Model...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Register & Compute Digital Twin</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

