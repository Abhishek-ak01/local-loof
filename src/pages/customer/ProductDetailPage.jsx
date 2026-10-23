import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Star, 
  ShoppingBag, 
  Heart, 
  Scale, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  Leaf, 
  Clock, 
  Plus, 
  Minus, 
  ArrowLeft,
  Store,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send
} from 'lucide-react';
import { getProductById, getSimilarProducts, getProductReviews, submitProductReview } from '../../services/db';
import { useCart } from '../../context/CartContext';
import { useComparison } from '../../context/ComparisonContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import ProductCard from '../../components/customer/ProductCard';
import InquiryModal from '../../components/common/InquiryModal';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { addToCart } = useCart();
  const { addToComparison, isInComparison, removeFromComparison } = useComparison();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewName, setReviewName] = useState(user?.fullName || '');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      try {
        const data = await getProductById(id);
        if (data) {
          setProduct(data);
          setActiveImageIndex(0);
          setQuantity(1);
          const similar = await getSimilarProducts(data.id, 4);
          setSimilarProducts(similar);
          const revs = await getProductReviews(data.id);
          setReviews(revs || []);
        }
      } catch (err) {
        console.error('Failed to load product details', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!product) return;
    setIsSubmittingReview(true);
    try {
      const newRev = await submitProductReview({
        productId: product.id,
        customerName: reviewName || user?.fullName || 'Neighbor',
        rating: reviewRating,
        reviewText,
        userId: user?.id || null
      });
      setReviews((prev) => [newRev, ...prev]);
      setReviewText('');
      addToast('Review submitted and recorded in Supabase!', 'success');
    } catch (err) {
      console.error('Failed to submit review', err);
      addToast(err.message || 'Failed to submit review', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-8">
          <div className="h-6 w-32 bg-cream-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="aspect-[4/3] bg-cream-200 rounded-3xl"></div>
            <div className="space-y-4">
              <div className="h-8 bg-cream-200 rounded w-3/4"></div>
              <div className="h-4 bg-cream-200 rounded w-1/4"></div>
              <div className="h-24 bg-cream-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto text-center py-24 px-4 space-y-4">
        <h2 className="text-2xl font-bold text-charcoal-900">Product Not Found</h2>
        <p className="text-xs text-charcoal-500">
          This product might have been unlisted or is no longer available in your region.
        </p>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 bg-forest-900 text-white text-xs font-bold px-5 py-2.5 rounded-full"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    );
  }

  const isLiked = isFavorite(product.id);
  const inCompare = isInComparison(product.id);
  const isOutOfStock = product.stockQuantity <= 0;
  const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-charcoal-500">
        <Link to="/" className="hover:text-forest-800">Home</Link>
        <span>/</span>
        <Link to="/marketplace" className="hover:text-forest-800">Marketplace</Link>
        <span>/</span>
        <span className="text-charcoal-800 font-semibold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Section: Gallery & Buying Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-14">
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-cream-100 border border-cream-300 shadow-md">
            <img
              src={product.images?.[activeImageIndex] || product.images?.[0]}
              alt={product.title}
              className="w-full h-full object-cover transition-all duration-300"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
              }}
            />
            {product.isOrganic && (
              <span className="absolute top-4 left-4 bg-forest-900/90 backdrop-blur-md text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                100% Certified Organic
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all shrink-0 bg-cream-100 ${
                    activeImageIndex === idx ? 'border-forest-700 shadow-md scale-95' : 'border-cream-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Title, Seller, Price, Stock & Actions */}
        <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Seller Bar */}
            {product.seller && (
              <div className="flex items-center justify-between pb-3 border-b border-cream-200">
                <Link
                  to={`/store/${product.seller.slug || product.seller.id}`}
                  className="flex items-center gap-2.5 group"
                >
                  <img
                    src={product.seller.logoUrl}
                    alt={product.seller.storeName}
                    className="w-8 h-8 rounded-full object-cover border border-cream-400"
                  />
                  <div>
                    <span className="text-xs font-bold text-charcoal-900 group-hover:text-forest-800 transition-colors block">
                      {product.seller.storeName}
                    </span>
                    <span className="text-[11px] text-forest-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{product.seller.neighborhood}</span>
                    </span>
                  </div>
                </Link>

                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Verified Local Maker
                </span>
              </div>
            )}

            {/* Product Title */}
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal-950 leading-tight">
              {product.title}
            </h1>

            {/* Ratings & Reviews */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-bold text-charcoal-900 ml-1.5">{product.rating}</span>
              </div>
              <span className="text-charcoal-400">•</span>
              <span className="text-charcoal-600 font-medium">{product.reviewCount} verified local reviews</span>
            </div>

            {/* Price & Unit */}
            <div className="pt-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-forest-950">
                  {formatCurrency(product.price)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-base text-charcoal-400 line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </span>
                )}
                <span className="text-xs text-charcoal-500 font-medium">
                  per {product.unit}
                </span>
              </div>
            </div>

            {/* Inventory Status with Real Time Limit */}
            <div className="pt-2">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Out of stock — Next morning harvest/bake coming soon.</span>
                </div>
              ) : isLowStock ? (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Low stock alert: Only {product.stockQuantity} units remaining for today!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Freshly stocked: {product.stockQuantity} available</span>
                </div>
              )}
            </div>

            {/* Short description */}
            <p className="text-xs sm:text-sm text-charcoal-600 leading-relaxed pt-1">
              {product.description}
            </p>
          </div>

          {/* Buying & Quantity Controls */}
          <div className="space-y-4 pt-6 border-t border-cream-300">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-charcoal-800">Quantity:</span>
              <div className="flex items-center border border-cream-300 rounded-xl bg-white shadow-sm">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="p-2 text-charcoal-600 hover:text-charcoal-900 disabled:opacity-30"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-bold text-charcoal-900 min-w-[32px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stockQuantity, q + 1))}
                  disabled={quantity >= product.stockQuantity || isOutOfStock}
                  className="p-2 text-charcoal-600 hover:text-charcoal-900 disabled:opacity-30"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs text-charcoal-500">
                Total: <strong>{formatCurrency(product.price * quantity)}</strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full bg-forest-900 hover:bg-forest-800 disabled:bg-cream-300 disabled:text-charcoal-400 text-white font-bold py-3.5 px-6 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span>Add to Basket</span>
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-cream-300 disabled:text-charcoal-400 text-white font-bold py-3.5 px-6 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <span>Direct Checkout</span>
              </button>
            </div>

            {/* Compare & Favorite Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  if (inCompare) removeFromComparison(product.id);
                  else addToComparison(product);
                }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  inCompare
                    ? 'bg-forest-50 border-forest-600 text-forest-800'
                    : 'bg-white border-cream-300 text-charcoal-700 hover:bg-cream-100'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>{inCompare ? 'In Comparison' : 'Compare with Others'}</span>
              </button>

              <button
                onClick={() => toggleFavorite(product)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  isLiked
                    ? 'bg-rose-50 border-rose-300 text-rose-600'
                    : 'bg-white border-cream-300 text-charcoal-700 hover:bg-cream-100'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                <span>{isLiked ? 'Saved in Favorites' : 'Save for Later'}</span>
              </button>
            </div>

            {/* Direct Inquiry / Question to Maker Button */}
            <button
              onClick={() => setIsInquiryOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-forest-300/80 bg-forest-50/70 hover:bg-forest-100 text-forest-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <span>Ask Maker a Question / Inquire</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabbed Specs, Origin & Reviews */}
      <div className="bg-white rounded-3xl border border-cream-300 p-6 sm:p-10 shadow-subtle space-y-6">
        <div className="flex border-b border-cream-200 gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab('description')}
            className={`pb-3 transition-colors border-b-2 -mb-px ${
              activeTab === 'description' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Sourcing & Freshness
          </button>
          <button
            onClick={() => setActiveTab('dietary')}
            className={`pb-3 transition-colors border-b-2 -mb-px ${
              activeTab === 'dietary' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Dietary & Storage
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 transition-colors border-b-2 -mb-px ${
              activeTab === 'reviews' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            Neighbor Reviews ({product.reviewCount + (reviews?.length || 0)})
          </button>
        </div>

        {activeTab === 'description' && (
          <div className="space-y-4 text-xs sm:text-sm text-charcoal-700 leading-relaxed max-w-3xl">
            <p>{product.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-cream-200">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-charcoal-900 block">Origin Neighborhood:</span>
                  <span>{product.originNeighborhood}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-charcoal-900 block">Shelf Life:</span>
                  <span>{product.shelfLife || 'Fresh daily'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dietary' && (
          <div className="space-y-4 text-xs sm:text-sm text-charcoal-700 max-w-2xl">
            <h4 className="font-bold text-charcoal-900">Dietary Badges:</h4>
            <div className="flex flex-wrap gap-2">
              {product.dietary?.map((tag, i) => (
                <span key={i} className="bg-forest-50 text-forest-800 font-semibold text-xs px-3 py-1 rounded-full border border-forest-200">
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-xs text-charcoal-500 pt-2">
              All ingredients are guaranteed non-GMO and free from artificial flavor enhancers or industrial emulsifiers.
            </p>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-8 max-w-3xl">
            {/* Reviews List */}
            <div className="space-y-4 divide-y divide-cream-200">
              {reviews.map((r) => (
                <div key={r.id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-charcoal-900 text-xs">
                      {r.customerName} {r.verifiedBuyer && <span className="text-emerald-700 font-semibold">(Verified Local Buyer)</span>}
                    </span>
                    <span className="text-[11px] text-charcoal-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex text-amber-500 my-1">
                    {[...Array(Math.floor(r.rating || 5))].map((_, idx) => (
                      <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-charcoal-600 leading-relaxed">
                    "{r.reviewText}"
                  </p>
                </div>
              ))}

              {/* Default historical sample review */}
              <div className="py-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-charcoal-900 text-xs">Maya Lin (Verified Local Buyer)</span>
                  <span className="text-[11px] text-charcoal-400">3 days ago</span>
                </div>
                <div className="flex text-amber-500 my-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                </div>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  "The aroma and crust were extraordinary. You simply can't buy food of this caliber in traditional supermarket chains. Arrived fresh!"
                </p>
              </div>
            </div>

            {/* Leave a review form (saves to Supabase product_reviews) */}
            <div className="bg-cream-50 p-5 rounded-2xl border border-cream-300 space-y-3">
              <h4 className="font-serif font-bold text-sm text-charcoal-900">
                Leave a Verified Neighbor Review
              </h4>
              <p className="text-xs text-charcoal-500">
                Share your tasting notes with neighbors. Your feedback is recorded in our Supabase backend.
              </p>
              <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-charcoal-800 block mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel Green"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-forest-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-charcoal-800 block mb-1">Rating</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(e.target.value)}
                      className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-forest-600 focus:outline-none"
                    >
                      <option value="5">★★★★★ (5 Stars - Outstanding)</option>
                      <option value="4">★★★★☆ (4 Stars - Great Local Quality)</option>
                      <option value="3">★★★☆☆ (3 Stars - Average)</option>
                      <option value="2">★★☆☆☆ (2 Stars - Needs Improvement)</option>
                      <option value="1">★☆☆☆☆ (1 Star - Poor)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-charcoal-800 block mb-1">Your Review</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe flavor, aroma, freshness, or packaging..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="w-full bg-white border border-cream-300 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-forest-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="bg-forest-900 hover:bg-forest-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSubmittingReview ? 'Submitting to Supabase...' : 'Post Neighbor Review'}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <InquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
        defaultProduct={product}
        defaultSeller={product.seller}
      />

      {/* Similar Products Carousel / Grid */}
      {similarProducts.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-forest-700">More Like This</span>
              <h3 className="font-serif text-2xl font-bold text-charcoal-950 mt-1">
                Similar Local Provisions
              </h3>
            </div>
            <Link
              to={`/marketplace?category=${product.categoryId}`}
              className="text-xs font-semibold text-forest-800 hover:text-forest-950"
            >
              View Category
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
