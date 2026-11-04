const TYPE_STYLE = {
  clothing: { icon: 'bi-handbag', bg: 'linear-gradient(160deg, #eef1f8, #dfe5f2)' },
  fashion: { icon: 'bi-bag-heart', bg: 'linear-gradient(160deg, #fff3e8, #ffe2c7)' },
  beauty: { icon: 'bi-stars', bg: 'linear-gradient(160deg, #fdeef3, #f8d9e4)' },
  accessories: { icon: 'bi-gem', bg: 'linear-gradient(160deg, #f1f0fb, #e1defa)' },
};

// How wide the photo is on screen, so phones download the small version
const SIZES = {
  card: '(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 300px',
  main: '(max-width: 767px) 100vw, 50vw',
  thumb: '80px',
};

export function imageSrcSet(image) {
  if (!image) return undefined;
  const parts = [];
  if (image.thumbUrl) parts.push(`${image.thumbUrl} 320w`);
  if (image.mediumUrl) parts.push(`${image.mediumUrl} 800w`);
  if (image.url && (image.thumbUrl || image.mediumUrl)) parts.push(`${image.url} 1600w`);
  return parts.length ? parts.join(', ') : undefined;
}

// Shows the product photo, or a branded placeholder until photos are uploaded.
// Pass `image` to show a specific photo instead of the product's n-th one.
export default function ProductImage({ product, index = 0, image, size = 'card', className = '', eager = false }) {
  const photo = image || product?.images?.[index];
  if (photo?.url) {
    return (
      <img
        src={size === 'thumb' ? photo.thumbUrl || photo.url : photo.mediumUrl || photo.url}
        srcSet={imageSrcSet(photo)}
        sizes={SIZES[size]}
        alt={photo.alt || product?.name || ''}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={`product-img ${className}`}
      />
    );
  }
  const style = TYPE_STYLE[product?.productType] || TYPE_STYLE.clothing;
  return (
    <div className={`img-placeholder ${className}`} style={{ background: style.bg }} role="img" aria-label={product?.name}>
      <i className={`bi ${style.icon}`} />
      {size !== 'thumb' && <span>Photo coming soon</span>}
    </div>
  );
}
