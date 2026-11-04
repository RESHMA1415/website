import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage.jsx';

// Product photos with thumbnails, zoom on hover, swipe on phones and the
// product video as the last slide (PRD §13.5). When a colour is chosen, only
// that colour's photos (plus photos for all colours) are shown (PRD §5.2).
export default function ProductGallery({ product, colour }) {
  const all = product.images || [];
  const forColour = colour ? all.filter((img) => !img.colour || img.colour === colour) : all.filter((img) => !img.colour);
  const photos = forColour.length ? forColour : all;
  const slides = [...photos.map((image) => ({ type: 'image', image })), ...(product.videoUrl ? [{ type: 'video', url: product.videoUrl }] : [])];

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const touchStart = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [colour, product._id]);

  if (!slides.length) {
    return (
      <div className="rounded-4 overflow-hidden">
        <ProductImage product={product} size="main" eager />
      </div>
    );
  }
  const current = slides[Math.min(index, slides.length - 1)];
  const go = (step) => setIndex((i) => (i + step + slides.length) % slides.length);

  return (
    <div className="d-flex gap-3">
      {slides.length > 1 && (
        <div className="d-none d-sm-flex flex-column gap-2 gallery-thumbs">
          {slides.map((slide, i) => (
            <button
              key={slide.type === 'video' ? 'video' : slide.image.url}
              type="button"
              className={`gallery-thumb ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={slide.type === 'video' ? 'Play product video' : `Show photo ${i + 1}`}
            >
              {slide.type === 'video' ? (
                <span className="video-thumb"><i className="bi bi-play-circle-fill" /></span>
              ) : (
                <ProductImage product={product} image={slide.image} size="thumb" />
              )}
            </button>
          ))}
        </div>
      )}
      <div
        className="flex-grow-1 rounded-4 overflow-hidden gallery-main"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchStart.current = null;
        }}
      >
        {current.type === 'video' ? (
          <video src={current.url} controls playsInline className="gallery-video" />
        ) : (
          <div
            className={`zoom-frame ${zoom ? 'zooming' : ''}`}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setZoom({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
            }}
            onMouseLeave={() => setZoom(null)}
          >
            <ProductImage
              product={product}
              image={current.image}
              size="main"
              eager
              className="zoom-img"
            />
            {zoom && (
              <div
                className="zoom-lens"
                style={{ backgroundImage: `url(${current.image.url})`, backgroundPosition: `${zoom.x}% ${zoom.y}%` }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
        {slides.length > 1 && (
          <>
            <button type="button" className="gallery-arrow prev d-sm-none" aria-label="Previous photo" onClick={() => go(-1)}><i className="bi bi-chevron-left" /></button>
            <button type="button" className="gallery-arrow next d-sm-none" aria-label="Next photo" onClick={() => go(1)}><i className="bi bi-chevron-right" /></button>
            <div className="gallery-dots d-sm-none">
              {slides.map((slide, i) => <span key={i} className={i === index ? 'active' : ''} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
