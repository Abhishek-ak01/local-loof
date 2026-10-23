import React, { useState } from 'react';
import { X, Send, MessageSquare, CheckCircle2, Store, Package, HelpCircle } from 'lucide-react';
import { submitInquiry } from '../../services/db';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function InquiryModal({ isOpen, onClose, defaultSeller = null, defaultProduct = null }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [inquiryType, setInquiryType] = useState(
    defaultProduct ? 'product_question' : defaultSeller ? 'seller_inquiry' : 'general'
  );
  const [subject, setSubject] = useState(
    defaultProduct 
      ? `Question about: ${defaultProduct.title || defaultProduct.name}`
      : defaultSeller
        ? `Inquiry for ${defaultSeller.storeName || defaultSeller.business_name}`
        : ''
  );
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      addToast('Please fill in your name, email, and message.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitInquiry({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim() || 'General Inquiry',
        message: message.trim(),
        inquiryType,
        sellerId: defaultSeller?.id || null,
        sellerName: defaultSeller?.storeName || defaultSeller?.business_name || null,
        productId: defaultProduct?.id || null,
        productName: defaultProduct?.title || defaultProduct?.name || null,
        sourceUrl: window.location.pathname,
      });

      setSubmitted(true);
      addToast('Your inquiry has been saved to our Supabase database!', 'success');
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      addToast(err.message || 'Failed to submit inquiry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full border border-cream-300 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-forest-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-forest-900 text-forest-200 hover:text-white hover:bg-forest-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-white">
                {defaultProduct 
                  ? 'Ask About This Provision'
                  : defaultSeller 
                    ? `Contact ${defaultSeller.storeName || defaultSeller.business_name}`
                    : 'Contact LocalLoop Support & Inquiries'}
              </h3>
              <p className="text-xs text-forest-300">
                Direct community communication • Saved to live Supabase backend
              </p>
            </div>
          </div>

          {(defaultProduct || defaultSeller) && (
            <div className="mt-3 pt-3 border-t border-forest-800/80 flex items-center gap-2 text-xs text-emerald-300">
              {defaultProduct ? (
                <>
                  <Package className="w-3.5 h-3.5" />
                  <span className="truncate font-semibold">{defaultProduct.title || defaultProduct.name}</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5" />
                  <span className="truncate font-semibold">{defaultSeller.storeName || defaultSeller.business_name}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-xl font-bold text-charcoal-900">Inquiry Received!</h4>
              <p className="text-xs text-charcoal-600 max-w-sm mx-auto leading-relaxed">
                Thank you! Your details and inquiry message have been recorded in our Supabase database. Our team or artisan will reply via email shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-charcoal-800 block mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Miller"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-cream-50 border border-cream-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-charcoal-800 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="jordan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-cream-50 border border-cream-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-charcoal-800 block mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-cream-50 border border-cream-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-charcoal-800 block mb-1">Inquiry Topic</label>
                  <select
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full bg-cream-50 border border-cream-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                  >
                    <option value="general">General Marketplace Question</option>
                    <option value="product_question">Product Sourcing & Allergens</option>
                    <option value="seller_inquiry">Direct Storefront Question</option>
                    <option value="custom_order">Custom Batch or Event Order</option>
                    <option value="partnership">Seller & Farm Partnership</option>
                    <option value="support">Neighborhood Delivery Support</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-charcoal-800 block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Summary of your question..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-cream-50 border border-cream-300 rounded-xl px-3 py-2 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-charcoal-800 block mb-1">Your Message *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="How can we or the maker help you today?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-cream-50 border border-cream-300 rounded-xl p-3 text-xs text-charcoal-900 focus:ring-2 focus:ring-forest-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-cream-300 text-charcoal-700 hover:bg-cream-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-98"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSubmitting ? 'Saving to Supabase...' : 'Send Inquiry'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
