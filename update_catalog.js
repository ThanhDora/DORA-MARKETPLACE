const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'Client/app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newProductCardCss = `
.product-card-v2 {
  display: flex;
  flex-direction: column;
  background: #f0eee6; /* Ivory Medium */
  border: none;
  border-radius: 8px;
  overflow: hidden;
  transition: background 220ms ease;
  padding: 0;
}

.product-card-v2:nth-child(even) {
  background: #e3dacc; /* Oat */
}

.product-card-v2:hover {
  background: #e8e6dc; /* Darker Ivory */
}
.product-card-v2:nth-child(even):hover {
  background: #dbd3c4; /* Darker Oat */
}

.product-card-v2__image-wrap {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #141413;
  flex-shrink: 0;
  text-decoration: none;
}

.product-card-v2__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 300ms ease;
}

.product-card-v2:hover .product-card-v2__img {
  opacity: 0.9;
}

.product-card-v2__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141413;
}

.product-card-v2__placeholder span {
  font-family: "JetBrains Mono", "IBM Plex Mono", monospace;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #faf9f5;
}

.product-card-v2__badges-top {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 2;
}

.product-card-v2__type-badge {
  font-family: "JetBrains Mono", "IBM Plex Mono", monospace;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #faf9f5;
  background: #141413;
  padding: 4px 8px;
  border-radius: 0;
}

.product-card-v2__stock-badge {
  font-family: "JetBrains Mono", "IBM Plex Mono", monospace;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #87867f;
  background: #141413;
  padding: 4px 8px;
  border-radius: 0;
}

.product-card-v2__stock-badge.is-live {
  color: #faf9f5 !important;
}

.product-card-v2__price-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 32px 16px 16px;
  background: linear-gradient(to top, rgba(20, 20, 19, 0.9) 0%, rgba(20, 20, 19, 0.4) 50%, transparent 100%);
  display: flex;
  align-items: baseline;
  gap: 4px;
  z-index: 2;
}

.product-card-v2__price {
  font-family: "DM Sans", sans-serif;
  font-size: 21px;
  font-weight: 700;
  color: #faf9f5;
  letter-spacing: -0.025em;
  line-height: 1;
}

.product-card-v2__unit {
  font-family: "DM Sans", sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: rgba(250, 249, 245, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.product-card-v2__body {
  padding: 24px 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.product-card-v2__title-link {
  text-decoration: none;
}

.product-card-v2__title {
  font-family: "DM Sans", "Inter", sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: #141413;
  letter-spacing: -0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.product-card-v2__title-link:hover .product-card-v2__title {
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 2px;
}

.product-card-v2__desc {
  font-family: "DM Sans", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  color: #141413;
  opacity: 0.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.product-card-v2__footer {
  padding: 12px 24px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.product-card-v2__rating {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: "JetBrains Mono", "IBM Plex Mono", monospace;
  font-size: 13px;
  font-weight: 400;
  color: #141413;
}

.product-card-v2__rating-num {
  color: #141413;
}

.product-card-v2__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-card-v2__wishlist-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #141413;
  border-radius: 0;
  background: transparent;
  color: #141413;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
  flex-shrink: 0;
}

.product-card-v2__wishlist-btn:hover:not(:disabled) {
  background: #141413;
  color: #faf9f5;
}

.product-card-v2__wishlist-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.product-card-v2__heart-active {
  fill: #141413 !important;
  color: #141413;
}

.product-card-v2__buy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  background: transparent;
  color: #141413;
  border: 1px solid #141413;
  border-radius: 0;
  font-family: "DM Sans", sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
  white-space: nowrap;
}

.product-card-v2__buy-btn:hover:not(:disabled) {
  background: #141413;
  color: #faf9f5;
}

.product-card-v2__buy-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
`;

// Replace .product-card-v2 section
const regex = /\.product-card-v2 \{[\s\S]*?\.product-card-v2__buy-btn:disabled \{[\s\S]*?\}/;
css = css.replace(regex, newProductCardCss.trim());

// Add search styles to catalog hero
const searchCss = `
/* Editorial Search Bar for Catalog Hero */
.catalog-v2__hero .search-autocomplete form {
  border: 1px solid #141413;
  border-radius: 0;
  background: #faf9f5;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  min-height: 54px;
}
.catalog-v2__hero .search-autocomplete form:focus-within {
  border-width: 2px;
  transform: none;
  box-shadow: none;
}
.catalog-v2__hero .search-autocomplete form input {
  font-family: "DM Sans", sans-serif;
  font-size: 18px;
  font-weight: 400;
  color: #141413;
}
.catalog-v2__hero .search-autocomplete form input::placeholder {
  color: #87867f;
  font-style: italic;
}
.catalog-v2__hero .search-autocomplete form svg {
  color: #141413;
}
.catalog-v2__hero .search-autocomplete form button {
  background: #141413;
  color: #faf9f5;
  border-radius: 0;
  font-family: "DM Sans", sans-serif;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 13px;
  min-height: 44px;
  box-shadow: none;
}
.catalog-v2__hero .search-autocomplete form button:hover {
  background: #3d3d3a;
  transform: none;
  box-shadow: none;
}
.catalog-v2__hero .search-suggestions {
  border-radius: 0;
  border: 1px solid #141413;
  box-shadow: 0 10px 30px rgba(20,20,19,0.15);
  background: #faf9f5;
}
.catalog-v2__hero .search-suggestions li:hover {
  background: #f0eee6;
  border-color: transparent;
}
.catalog-v2__hero .suggestion-body strong {
  font-family: "DM Sans", sans-serif;
  font-weight: 600;
  color: #141413;
}
`;

if (!css.includes('.catalog-v2__hero .search-autocomplete form')) {
  css = css.replace('.catalog-v2 {', searchCss + '\n.catalog-v2 {');
}

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS replaced successfully.');
